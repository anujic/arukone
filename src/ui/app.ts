import { type Puzzle, type Size, SIZES } from '../core/types';
import { Board } from '../game/board';
import { Timer, formatTime } from '../game/timer';
import { PuzzleSource } from '../game/source';
import { type Progress, type SaveFile, clearSave, createSaver, loadSave, statsFor } from '../storage/store';
import { cellAt, createBoardSvg, renderBoard } from './board';
import { ICONS } from './icons';

type Screen = 'game' | 'archive' | 'stats';
/** loading: generating; play: in progress; solved: read-only solved view; replay(-done): unscored replay. */
type Mode = 'loading' | 'play' | 'solved' | 'replay' | 'replay-done';

interface Gesture {
  id: number;
  x0: number;
  y0: number;
  moved: boolean;
  drawing: boolean;
  tapPair: number;
  /** Drag started on the loose end of an unfinished path. */
  continued: boolean;
  /** The path changed during this gesture. */
  changed: boolean;
}

const TAP_SLOP_PX = 8;
const SOLVED_MSG = 'All pairs correctly connected. Fantastic!';

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html !== undefined) el.innerHTML = html;
  return el;
}

const vibrate = (ms: number) => {
  try {
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (activation && !activation.hasBeenActive) return;
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
};

const dayLabel = (t: number, now = Date.now()) => {
  const d = new Date(t).toDateString();
  if (d === new Date(now).toDateString()) return 'Today';
  if (d === new Date(now - 86_400_000).toDateString()) return 'Yesterday';
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export class App {
  private data: SaveFile = loadSave();
  private saver = createSaver(() => this.data);
  private source = new PuzzleSource(() => this.data, () => this.saver.schedule());

  private screen: Screen = 'game';
  private mode: Mode = 'loading';
  private puzzle: Puzzle | null = null;
  private board: Board | null = null;
  private timer = new Timer();
  private replayMs = 0;
  private gesture: Gesture | null = null;
  private renderQueued = false;
  private archiveFilter: Size | 'all' = 'all';
  private statsSize: Size = this.data.selectedSize;

  // Game screen elements
  private gameEl!: HTMLElement;
  private timerEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private svg!: SVGSVGElement;
  private sizeBtns = new Map<Size, HTMLButtonElement>();
  private newBtn!: HTMLButtonElement;
  private resultsBtn!: HTMLButtonElement;
  private replayBtn!: HTMLButtonElement;
  private archiveEl!: HTMLElement;
  private statsEl!: HTMLElement;
  private sheetEl: HTMLElement | null = null;

  constructor(private readonly root: HTMLElement) {
    this.buildGame();
    this.archiveEl = h('section', 'screen');
    this.statsEl = h('section', 'screen');
    root.append(this.gameEl, this.archiveEl, this.statsEl);
    this.bindGlobal();
    this.showScreen('game');

    const cur = this.data.current ? this.data.puzzles[this.data.current] : undefined;
    if (cur) this.openPuzzle(cur);
    else void this.newPuzzle();
    this.source.topUp(this.data.selectedSize);
    setInterval(() => this.updateTimer(), 250);
  }

  // ---------------------------------------------------------------- building

  private buildGame() {
    const el = h('section', 'screen game');
    const top = h('header', 'topbar');
    const archiveBtn = h('button', 'icon-btn', ICONS.archive);
    archiveBtn.setAttribute('aria-label', 'Archive');
    archiveBtn.onclick = () => this.showScreen('archive');
    const statsBtn = h('button', 'icon-btn', ICONS.stats);
    statsBtn.setAttribute('aria-label', 'Stats');
    statsBtn.onclick = () => this.showScreen('stats');
    top.append(archiveBtn, h('h1', '', 'Arukone'), statsBtn);

    this.timerEl = h('div', 'timer', '0:00');
    this.statusEl = h('div', 'status');

    const wrap = h('div', 'board-wrap');
    this.svg = createBoardSvg();
    wrap.append(this.svg);
    this.bindBoardInput();

    const sizes = h('div', 'sizes');
    sizes.append(h('span', 'sizes-label', 'New puzzle size'));
    const seg = h('div', 'segmented');
    seg.setAttribute('role', 'radiogroup');
    for (const s of SIZES) {
      const b = h('button', '', `${s}×${s}`);
      b.setAttribute('role', 'radio');
      b.onclick = () => this.selectSize(s);
      this.sizeBtns.set(s, b);
      seg.append(b);
    }
    sizes.append(seg);

    const foot = h('footer', 'actions');
    this.newBtn = h('button', 'pill', 'New puzzle');
    this.newBtn.onclick = () => void this.newPuzzle();
    const row = h('div', 'pill-row');
    this.resultsBtn = h('button', 'pill', 'Show results');
    this.resultsBtn.onclick = () => this.showResults();
    this.replayBtn = h('button', 'pill', 'Replay');
    this.replayBtn.onclick = () => this.puzzle && this.openPuzzle(this.puzzle, true);
    row.append(this.resultsBtn, this.replayBtn);
    foot.append(this.newBtn, row);

    el.append(top, this.timerEl, this.statusEl, wrap, sizes, foot);
    this.gameEl = el;
  }

  private bindGlobal() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.timer.pause();
        this.persist();
        this.saver.flush();
      } else {
        this.resumeTimer();
      }
    });
    window.addEventListener('pagehide', () => {
      this.persist();
      this.saver.flush();
    });
    // iOS: block pinch-zoom gestures.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  private bindBoardInput() {
    const svg = this.svg;
    svg.addEventListener('pointerdown', (e) => {
      if (!this.board || (this.mode !== 'play' && this.mode !== 'replay') || this.gesture) return;
      const c = cellAt(svg, this.board.size, e.clientX, e.clientY, 0);
      if (c === null) return;
      e.preventDefault();
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {
        /* capture unsupported for this pointer; moves still arrive while over the board */
      }
      const g: Gesture = {
        id: e.pointerId, x0: e.clientX, y0: e.clientY,
        moved: false, drawing: false, tapPair: -1, continued: false, changed: false,
      };
      if (this.board.start(c)) {
        g.drawing = true;
        this.queueRender();
      } else {
        g.tapPair = this.board.ownerOf(c);
        // Pressing the loose end of an unfinished path continues it; a plain tap still clears it.
        if (this.board.continueFrom(c)) g.drawing = g.continued = true;
      }
      this.gesture = g;
    });
    svg.addEventListener('pointermove', (e) => {
      const g = this.gesture;
      if (!g || g.id !== e.pointerId || !this.board) return;
      if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > TAP_SLOP_PX) g.moved = true;
      if (!g.drawing) return;
      const c = cellAt(svg, this.board.size, e.clientX, e.clientY);
      if (c === null) return;
      const r = this.board.moveTo(c);
      if (r === 'none') return;
      g.changed = true;
      this.queueRender();
      if (r === 'connected') {
        vibrate(10);
        if (this.board.isSolved()) this.finishGesture(e.pointerId, false);
      }
    });
    const up = (e: PointerEvent, cancel: boolean) => {
      if (this.gesture?.id === e.pointerId) this.finishGesture(e.pointerId, cancel);
    };
    svg.addEventListener('pointerup', (e) => up(e, false));
    svg.addEventListener('pointercancel', (e) => up(e, true));
  }

  private finishGesture(pointerId: number, cancel: boolean) {
    const g = this.gesture;
    const board = this.board;
    this.gesture = null;
    if (!g || !board) return;
    try {
      if (this.svg.hasPointerCapture(pointerId)) this.svg.releasePointerCapture(pointerId);
    } catch {
      /* ignore */
    }
    if (g.drawing) board.end();
    const isTap = !cancel && !g.moved && !g.changed && g.tapPair >= 0;
    if (isTap && (!g.drawing || g.continued)) board.clearPath(g.tapPair);
    this.queueRender();
    this.persist();
    if (board.isSolved()) this.onSolved();
  }

  // ---------------------------------------------------------------- game flow

  private progressOf(id: string): Progress {
    return (this.data.progress[id] ??= { puzzleId: id, paths: [], elapsedMs: 0, updatedAt: Date.now() });
  }

  /** Save the in-progress puzzle (not replays). */
  private persist() {
    if (this.mode !== 'play' || !this.puzzle || !this.board) return;
    const prog = this.progressOf(this.puzzle.id);
    prog.paths = this.board.paths.map((p) => p.slice());
    prog.elapsedMs = this.timer.ms;
    prog.updatedAt = Date.now();
    this.saver.schedule();
  }

  private openPuzzle(puzzle: Puzzle, replay = false) {
    this.persist();
    this.timer.pause();
    this.closeSheet();
    this.puzzle = puzzle;
    this.data.current = puzzle.id;
    const prog = this.progressOf(puzzle.id);
    if (replay) {
      this.board = new Board(puzzle);
      this.timer = new Timer(0);
      this.mode = 'replay';
    } else if (prog.solveTimeMs !== undefined) {
      this.board = new Board(puzzle, prog.paths);
      this.timer = new Timer(prog.solveTimeMs);
      this.mode = 'solved';
    } else {
      this.board = new Board(puzzle, prog.paths);
      this.timer = new Timer(prog.elapsedMs);
      this.mode = 'play';
    }
    this.svg.classList.remove('solved');
    this.saver.schedule();
    this.resumeTimer();
    this.renderNow();
    this.updateChrome();
  }

  private generating = false;

  private async newPuzzle() {
    if (this.generating) return;
    this.generating = true;
    this.persist();
    this.timer.pause();
    this.closeSheet();
    const prevMode = this.mode;
    this.mode = 'loading';
    this.updateChrome();
    const size = this.data.selectedSize;
    let def;
    try {
      def = await this.source.take(size);
    } catch {
      this.mode = prevMode;
      this.generating = false;
      this.updateChrome();
      return;
    }
    this.generating = false;
    const puzzle: Puzzle = { ...def, number: ++this.data.counter, createdAt: Date.now() };
    this.data.puzzles[puzzle.id] = puzzle;
    this.data.progress[puzzle.id] = { puzzleId: puzzle.id, paths: [], elapsedMs: 0, updatedAt: Date.now() };
    this.mode = 'play';
    this.openPuzzle(puzzle);
  }

  private onSolved() {
    if (!this.puzzle || !this.board) return;
    this.timer.pause();
    if (this.mode === 'play') {
      const prog = this.progressOf(this.puzzle.id);
      prog.paths = this.board.paths.map((p) => p.slice());
      prog.elapsedMs = this.timer.ms;
      prog.solveTimeMs = this.timer.ms;
      prog.solvedAt = Date.now();
      this.mode = 'solved';
      this.saver.flush();
    } else if (this.mode === 'replay') {
      this.replayMs = this.timer.ms;
      this.mode = 'replay-done';
    } else return;
    vibrate(30);
    this.svg.classList.remove('solved');
    void this.svg.getBoundingClientRect();
    this.svg.classList.add('solved');
    this.updateChrome();
    this.updateTimer();
    setTimeout(() => {
      if (this.screen === 'game' && (this.mode === 'solved' || this.mode === 'replay-done')) this.showResults();
    }, 900);
  }

  private resumeTimer() {
    if (!document.hidden && this.screen === 'game' && (this.mode === 'play' || this.mode === 'replay')) this.timer.start();
  }

  private selectSize(s: Size) {
    this.data.selectedSize = s;
    this.saver.schedule();
    this.source.topUp(s);
    this.updateChrome();
  }

  // ---------------------------------------------------------------- rendering

  private queueRender() {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.renderNow();
    });
  }

  private renderNow() {
    if (this.puzzle && this.board) renderBoard(this.svg, this.puzzle, this.board.paths);
    else this.svg.innerHTML = '';
  }

  private updateTimer() {
    const ms = this.mode === 'replay-done' ? this.replayMs : this.timer.ms;
    const text = this.mode === 'loading' && !this.puzzle ? '0:00' : formatTime(ms);
    if (this.timerEl.textContent !== text) this.timerEl.textContent = text;
  }

  private updateChrome() {
    const m = this.mode;
    const solved = m === 'solved' || m === 'replay-done';
    let status = '';
    let cls = 'status';
    if (m === 'loading') {
      status = '<span class="spinner"></span>Generating puzzle…';
      cls += ' muted';
    } else if (solved) {
      status = SOLVED_MSG;
    } else if (m === 'replay') {
      status = `Replay of #${this.puzzle?.number} · not counted`;
      cls += ' muted';
    } else if (this.puzzle) {
      status = `#${this.puzzle.number} · ${this.puzzle.size}×${this.puzzle.size} · ${this.puzzle.pairs.length} pairs`;
      cls += ' muted';
    }
    this.statusEl.className = cls;
    this.statusEl.innerHTML = status;
    this.gameEl.classList.toggle('is-loading', m === 'loading');
    this.newBtn.disabled = m === 'loading';
    this.resultsBtn.disabled = !solved;
    this.replayBtn.hidden = !solved;
    for (const [s, b] of this.sizeBtns) {
      const on = s === this.data.selectedSize;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    }
    this.updateTimer();
  }

  // ---------------------------------------------------------------- screens

  private showScreen(s: Screen) {
    if (this.screen === 'game' && s !== 'game') {
      this.persist();
      this.timer.pause();
    }
    this.closeSheet();
    this.screen = s;
    this.gameEl.hidden = s !== 'game';
    this.archiveEl.hidden = s !== 'archive';
    this.statsEl.hidden = s !== 'stats';
    if (s === 'archive') this.renderArchive();
    if (s === 'stats') this.renderStats();
    if (s === 'game') {
      if (!this.puzzle && this.mode !== 'loading') void this.newPuzzle();
      else this.resumeTimer();
    }
  }

  private subHeader(title: string): HTMLElement {
    const top = h('header', 'topbar');
    const back = h('button', 'icon-btn', ICONS.back);
    back.setAttribute('aria-label', 'Back');
    back.onclick = () => this.showScreen('game');
    top.append(back, h('h1', '', title), h('span', 'icon-btn spacer'));
    return top;
  }

  private chips<T extends string | number>(options: [T, string][], active: T, onPick: (v: T) => void): HTMLElement {
    const seg = h('div', 'segmented');
    for (const [v, label] of options) {
      const b = h('button', v === active ? 'on' : '', label);
      b.onclick = () => onPick(v);
      seg.append(b);
    }
    return seg;
  }

  private renderArchive() {
    const el = this.archiveEl;
    el.innerHTML = '';
    el.className = 'screen archive';
    el.append(this.subHeader('Archive'));
    const filterOpts: [Size | 'all', string][] = [['all', 'All'], ...SIZES.map((s) => [s, `${s}×${s}`] as [Size, string])];
    const filters = h('div', 'filters');
    filters.append(
      this.chips(filterOpts, this.archiveFilter, (v) => {
        this.archiveFilter = v;
        this.renderArchive();
      }),
    );
    el.append(filters);

    const list = h('div', 'list');
    const puzzles = Object.values(this.data.puzzles)
      .filter((p) => this.archiveFilter === 'all' || p.size === this.archiveFilter)
      .sort((a, b) => b.createdAt - a.createdAt);
    if (!puzzles.length) list.append(h('p', 'empty', 'No puzzles yet.'));
    let lastDay = '';
    for (const p of puzzles) {
      const day = dayLabel(p.createdAt);
      if (day !== lastDay) {
        list.append(h('h2', 'day', day));
        lastDay = day;
      }
      const prog = this.data.progress[p.id];
      const solved = prog?.solveTimeMs !== undefined;
      const row = h('div', 'row');
      const open = h('button', 'row-main');
      const thumb = createBoardSvg('thumb');
      renderBoard(thumb, p, prog?.paths ?? [], { letters: false });
      const info = h('div', 'row-info');
      info.append(h('div', 'row-title', `#${p.number} · ${p.size}×${p.size}`));
      const live = this.puzzle?.id === p.id && this.mode === 'play' ? this.timer.ms : (prog?.elapsedMs ?? 0);
      info.append(
        h(
          'div',
          solved ? 'row-sub ok' : 'row-sub',
          solved ? `✓ Solved in ${formatTime(prog!.solveTimeMs!)}` : `In progress · ${formatTime(live)}`,
        ),
      );
      open.append(thumb, info);
      open.onclick = () => {
        this.openPuzzle(p);
        this.showScreen('game');
      };
      const del = h('button', 'icon-btn del', ICONS.trash);
      del.setAttribute('aria-label', `Delete puzzle #${p.number}`);
      del.onclick = () => {
        if (!confirm(`Delete puzzle #${p.number}? This cannot be undone.`)) return;
        delete this.data.puzzles[p.id];
        delete this.data.progress[p.id];
        if (this.puzzle?.id === p.id) {
          this.puzzle = null;
          this.board = null;
          this.data.current = undefined;
          this.mode = 'play';
          this.renderNow();
        }
        this.saver.flush();
        this.renderArchive();
      };
      row.append(open, del);
      list.append(row);
    }
    el.append(list);
  }

  private renderStats() {
    const el = this.statsEl;
    el.innerHTML = '';
    el.className = 'screen stats';
    el.append(this.subHeader('Stats'));
    const tabs = h('div', 'filters');
    tabs.append(
      this.chips(
        SIZES.map((s) => [s, `${s}×${s}`] as [Size, string]),
        this.statsSize,
        (v) => {
          this.statsSize = v;
          this.renderStats();
        },
      ),
    );
    el.append(tabs);

    const st = statsFor(this.data, this.statsSize);
    const tiles = h('div', 'tiles');
    const tile = (label: string, value: string) => {
      const t = h('div', 'tile');
      t.append(h('div', 'tile-value', value), h('div', 'tile-label', label));
      tiles.append(t);
    };
    tile('Solved', String(st.solved));
    tile('Solved today', String(st.solvedToday));
    tile('Best time', st.best !== undefined ? formatTime(st.best) : '–');
    tile('Average time', st.average !== undefined ? formatTime(st.average) : '–');
    el.append(tiles);

    const chart = h('div', 'chart');
    chart.append(h('h2', 'day', 'Recent times'));
    if (!st.recent.length) chart.append(h('p', 'empty', 'Solve a puzzle to see your times here.'));
    else {
      const bars = h('div', 'bars');
      const max = Math.max(...st.recent);
      for (const t of st.recent) {
        const b = h('div', 'bar');
        b.style.height = `${Math.max(4, (t / max) * 100)}%`;
        b.title = formatTime(t);
        if (t === st.best) b.classList.add('best');
        bars.append(b);
      }
      chart.append(bars);
      chart.append(h('div', 'bars-caption', `Last ${st.recent.length} · longest ${formatTime(max)}`));
    }
    el.append(chart);

    const reset = h('button', 'pill danger', 'Reset all data');
    reset.onclick = () => {
      if (!confirm('Delete all puzzles, progress and stats? This cannot be undone.')) return;
      const size = this.data.selectedSize;
      this.data = clearSave();
      this.data.selectedSize = size;
      this.puzzle = null;
      this.board = null;
      this.mode = 'play';
      this.renderNow();
      this.saver.flush();
      this.renderStats();
    };
    const foot = h('footer', 'actions');
    foot.append(reset);
    el.append(foot);
  }

  // ---------------------------------------------------------------- results sheet

  private showResults() {
    if (!this.puzzle) return;
    this.closeSheet();
    const p = this.puzzle;
    const prog = this.data.progress[p.id];
    const isReplay = this.mode === 'replay-done';
    const time = isReplay ? this.replayMs : (prog?.solveTimeMs ?? 0);
    const st = statsFor(this.data, p.size);
    const newBest = !isReplay && st.solved > 1 && st.best === prog?.solveTimeMs;

    const back = h('div', 'sheet-backdrop');
    back.onclick = (e) => e.target === back && this.closeSheet();
    const sheet = h('div', 'sheet');
    sheet.setAttribute('role', 'dialog');
    sheet.append(h('div', 'grabber'));
    sheet.append(h('div', 'sheet-time', formatTime(time)));
    if (newBest) sheet.append(h('div', 'badge', 'New best!'));
    if (isReplay) sheet.append(h('div', 'badge muted', 'Replay · not counted in stats'));
    const solvedAt = prog?.solvedAt ?? Date.now();
    sheet.append(
      h('div', 'sheet-meta', `Puzzle #${p.number} · ${p.size}×${p.size} · ${dayLabel(solvedAt)}`),
    );
    const sum = h('div', 'sheet-stats');
    const stat = (v: string, l: string) => {
      const d = h('div');
      d.append(h('strong', '', v), h('span', '', l));
      sum.append(d);
    };
    stat(String(st.solved), `solved (${p.size}×${p.size})`);
    stat(st.best !== undefined ? formatTime(st.best) : '–', 'best time');
    if (isReplay && prog?.solveTimeMs !== undefined) stat(formatTime(prog.solveTimeMs), 'original time');
    sheet.append(sum);
    const actions = h('div', 'actions');
    const next = h('button', 'pill primary', 'New puzzle');
    next.onclick = () => void this.newPuzzle();
    const close = h('button', 'pill', 'Close');
    close.onclick = () => this.closeSheet();
    actions.append(next, close);
    sheet.append(actions);
    back.append(sheet);
    this.root.append(back);
    this.sheetEl = back;
    requestAnimationFrame(() => back.classList.add('open'));
  }

  private closeSheet() {
    this.sheetEl?.remove();
    this.sheetEl = null;
  }
}
