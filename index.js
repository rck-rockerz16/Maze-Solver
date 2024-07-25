function asyncFor(start, end, step, callback, delay) {
  return asyncLoop(function (value, finish) {
    if (value >= end) {
      return finish();
    }
    var result = callback(value);
    if (!(result instanceof Promise)) {
      result = Promise.resolve(result);
    }
    return result.then(function () {
      return value + step;
    });
  }, start, delay);
}

function asyncLoop(callback, value, delay) {
  var status = arguments[3] || {
    done: false,
    finish: function () {
      this.done = true;
    }
  };

  var promise = new Promise(function (resolve, reject) {
    setTimeout(function () {
      value = callback(value, status.finish.bind(status));
      if (!(value instanceof Promise)) {
        value = Promise.resolve(value);
      }
      value.then(function (nextValue) {
        if (status.done) {
          resolve();
        } else {
          resolve(asyncLoop(callback, nextValue, delay, status));
        }
      });
    }, delay || 0);
  });

  return modifiedPromise(promise, function () {
    status.finish();
  });
}

function modifiedPromise(promise, abort) {
  var promiseAbort = promise.abort;
  promise.abort = function () {
    if (promiseAbort) {
      promiseAbort.apply(promise, arguments);
    }
    abort();
  };
  var promiseThen = promise.then;
  promise.then = function () {
    promise = promiseThen.apply(promise, arguments);
    return modifiedPromise(promise, abort);
  };
  var promiseCatch = promise.catch;
  promise.catch = function () {
    promise = promiseCatch.apply(promise, arguments);
    return modifiedPromise(promise, abort);
  };
  return promise;
}

function randomArrayItem(array) {
  var index = randomArrayIndex(array);
  return array[index];
}

function randomArrayIndex(array) {
  return Math.floor(array.length * Math.random());
}

function Direction() {
  throw new Error("Don't use this constructor");
}

Direction.N = 'north';
Direction.S = 'south';
Direction.E = 'east';
Direction.W = 'west';

Direction.OPPOSITES = {};
Direction.OPPOSITES[Direction.N] = Direction.S;
Direction.OPPOSITES[Direction.S] = Direction.N;
Direction.OPPOSITES[Direction.E] = Direction.W;
Direction.OPPOSITES[Direction.W] = Direction.E;

Direction.TRANSLATIONS = {};
Direction.TRANSLATIONS[Direction.N] = [-1, 0];
Direction.TRANSLATIONS[Direction.S] = [+1, 0];
Direction.TRANSLATIONS[Direction.E] = [0, +1];
Direction.TRANSLATIONS[Direction.W] = [0, -1];

Direction.all = function () {
  return [Direction.N, Direction.S, Direction.E, Direction.W];
};

Direction.opposite = function (direction) {
  return Direction.OPPOSITES[direction];
};

Direction.shift = function (row, col, direction) {
  var translation = Direction.TRANSLATIONS[direction];
  return [row + translation[0], col + translation[1]];
};
function Cell(row, col) {
  this.row = row;
  this.col = col;

  this.id = Cell._idx++;
  this.type = Cell.NORMAL;
  this.marks = new Set();

  this.openDirections = new Set();
  this.closedDirections = new Set(Direction.all());
}
Cell._idx = 1;

Cell.NORMAL = "normal";
Cell.START = "start";
Cell.FINISH = "finish";

Cell.GENERATED = "generated";
Cell.CURRENT = "current";
Cell.VISITED = "visited";
Cell.SOLUTION = "solution";

Cell.prototype.isNormal = function () {
  return this.type === Cell.NORMAL;
};

Cell.prototype.isStart = function () {
  return this.type === Cell.START;
};

Cell.prototype.isFinish = function () {
  return this.type === Cell.FINISH;
};

Cell.prototype.setNormal = function () {
  this.type = Cell.NORMAL;
  return this;
};

Cell.prototype.setStart = function () {
  this.type = Cell.START;
  return this;
};

Cell.prototype.setFinish = function () {
  this.type = Cell.FINISH;
  return this;
};

Cell.prototype.open = function (direction) {
  this.closedDirections.delete(direction);
  this.openDirections.add(direction);
  return this;
};

Cell.prototype.close = function (direction) {
  this.openDirections.delete(direction);
  this.closedDirections.add(direction);
  return this;
};

Cell.prototype.isOpen = function (direction) {
  return this.openDirections.has(direction);
};

Cell.prototype.isClosed = function (direction) {
  return this.closedDirections.has(direction);
};

Cell.prototype.clearMarks = function () {
  this.marks.clear();
  return this;
};

Cell.prototype.markCurrent = function () {
  this.marks.add(Cell.CURRENT);
  return this;
};

Cell.prototype.markVisited = function () {
  this.marks.add(Cell.VISITED);
  return this;
};

Cell.prototype.markGenerated = function () {
  this.marks.add(Cell.GENERATED);
  return this;
};

Cell.prototype.markSolution = function () {
  this.marks.add(Cell.SOLUTION);
  return this;
};

Cell.prototype.unmarkCurrent = function () {
  this.marks.delete(Cell.CURRENT);
  return this;
};

Cell.prototype.unmarkVisited = function () {
  this.marks.delete(Cell.VISITED);
  return this;
};

Cell.prototype.unmarkGenerated = function () {
  this.marks.delete(Cell.GENERATED);
  return this;
};

Cell.prototype.unmarkSolution = function () {
  this.marks.delete(Cell.SOLUTION);
  return this;
};

Cell.prototype.isMarkedCurrent = function () {
  return this.marks.has(Cell.CURRENT);
};

Cell.prototype.isMarkedVisited = function () {
  return this.marks.has(Cell.VISITED);
};

Cell.prototype.isMarkedGenerated = function () {
  return this.marks.has(Cell.GENERATED);
};

Cell.prototype.isMarkedSolution = function () {
  return this.marks.has(Cell.SOLUTION);
};

Cell.prototype.isAdjacent = function (other) {
  let drow = Math.abs(this.row - other.row);
  let dcol = Math.abs(this.col - other.col);
  return (drow === 0 && dcol === 1) || (drow === 1 && dcol === 0);
};

Cell.prototype.directionTo = function (other) {
  var directions = Direction.all();
  for (var i = 0; i < directions.length; i++) {
    var direction = directions[i];
    var shifted = Direction.shift(this.row, this.col, direction);
    if (shifted[0] === other.row && shifted[1] === other.col) {
      return direction;
    }
  }
  throw new Error("Other cell is not adjacent");
};

Cell.prototype.isOpenTo = function (other) {
  var direction = this.directionTo(other);
  return this.isOpen(direction);
};

Cell.prototype.squaredDistanceTo = function (other) {
  return Math.pow(this.row - other.row, 2) + Math.pow(this.col - other.col, 2);
};
function Maze(rows, columns) {
  rows = rows || 30;
  columns = columns || 30;
  this.grid = [];
  for (var i = 0; i < rows; i++) {
    var row = [];
    for (var j = 0; j < rows; j++) {
      row.push(new Cell(i, j));
    }
    this.grid.push(row);
  }
}

Maze.prototype.rows = function () {
  return this.grid.length;
};

Maze.prototype.cols = function () {
  return this.grid[0] ? this.grid[0].length : 0;
};

Maze.prototype.get = function (row, col) {
  if (this.grid[row]) {
    return this.grid[row][col];
  }
};

Maze.prototype.getById = function (id) {
  for (var i = 0; i < maze.rows(); i++) {
    for (var j = 0; j < maze.cols(); j++) {
      var cell = maze.get(i, j);
      if (cell.id === id) {
        return cell;
      }
    }
  }
};

Maze.prototype.isEdge = function (cell) {
  return cell.row === 0 || cell.row === (this.rows() - 1) || cell.col === 0 || cell.col === (this.cols() - 1);
};

Maze.prototype.findStart = function () {
  var edgeCells = this.edgeCells();
  for (var i = 0; i < edgeCells.length; i++) {
    var cell = edgeCells[i];
    if (cell.isStart()) {
      return cell;
    }
  }
};

Maze.prototype.findFinish = function () {
  var edgeCells = this.edgeCells();
  for (var i = 0; i < edgeCells.length; i++) {
    var cell = edgeCells[i];
    if (cell.isFinish()) {
      return cell;
    }
  }
};

Maze.prototype.edgeCells = function () {
  var rows = this.rows();
  var cols = this.cols();
  var edges = [];
  for (var i = 0; i < rows; i++) {
    edges.push(this.get(i, 0));
    edges.push(this.get(i, cols - 1));
  }
  for (var j = 0; j < cols; j++) {
    edges.push(this.get(0, j));
    edges.push(this.get(rows - 1, j));
  }
  return edges;
};

Maze.prototype.randomEdge = function (other) {
  var random = this._randomEdge();
  while (random === other) {
    random = this._randomEdge();
  }
  return random;
};

Maze.prototype._randomEdge = function () {
  var edges = this.edgeCells();
  return edges[Math.floor(edges.length * Math.random())];
};

Maze.prototype.openBetween = function (cell, other) {
  var direction = cell.directionTo(other);
  this.openWall(cell, direction);
};  

Maze.prototype.closeBetween = function (cell, other) {
  var direction = cell.directionTo(other);
  this.closeWall(cell, direction);
};

Maze.prototype.openWall = function (cell, direction) {
  cell.open(direction);
  var adjacent = this.adjacentTo(cell, direction);
  if (adjacent) {
    var opposite = Direction.opposite(direction);
    adjacent.open(opposite);
  }
};

Maze.prototype.closeWall = function (cell, direction) {
  cell.close(direction);
  var adjacent = this.adjacentTo(cell, direction);
  if (adjacent) {
    var opposite = Direction.opposite(direction);
    adjacent.close(opposite);
  }
};

Maze.prototype.adjacents = function (cell) {
  return this._adjacentsInDirections(cell, Direction.all());
};

Maze.prototype.openAdjacents = function (cell) {
  return this._adjacentsInDirections(cell, Array.from(cell.openDirections));
};

Maze.prototype.closedAdjacents = function (cell) {
  return this._adjacentsInDirections(cell, Array.from(cell.closedDirections));
};

Maze.prototype._adjacentsInDirections = function (cell, directions) {
  var adjacents = [];
  directions.forEach(function (direction) {
    var adj = this.adjacentTo(cell, direction);
    if (adj) {
      adjacents.push(adj);
    }
  }.bind(this));
  return adjacents;
};

Maze.prototype.adjacentTo = function (cell, direction) {
  var adjCoords = Direction.shift(cell.row, cell.col, direction);
  return this.get(adjCoords[0], adjCoords[1]);
};

Maze.prototype.cells = function () {
  var cells = [];
  for (var i = 0; i < maze.rows(); i++) {
    for (var j = 0; j < maze.cols(); j++) {
      var cell = maze.get(i, j);
      cells.push(cell);
    }
  }
  return cells;
};

Maze.prototype.visitedCells = function () {
  return this.cells().filter(function (cell) {
    return cell.isMarkedVisited();
  });
};
function MazeRenderer(maze) {
  this.maze = maze;
  this.padding = 15;
  this.canvas = {
    background: null,
    walls: null,
    solution: null
  };
  this.ctx = {
    background: null,
    walls: null,
    solution: null
  };
  this.config = {
    walls: {
      style: '#444',
      lineWidth: 2
    }
  }
  this.backgroundCache = this.emptyBackgroundCache();
}

MazeRenderer.prototype.setMaze = function (maze) {
  this.maze = maze;
  this.backgroundCache = this.emptyBackgroundCache();
};

MazeRenderer.prototype.setBackgroundCanvas = function (canvas, ctx) {
  this.canvas.background = canvas;
  this.ctx.background = ctx || canvas.getContext("2d");
};

MazeRenderer.prototype.setWallsCanvas = function (canvas, ctx) {
  this.canvas.walls = canvas;
  this.ctx.walls = ctx || canvas.getContext("2d");
};

MazeRenderer.prototype.setSolutionCanvas = function (canvas, ctx) {
  this.canvas.solution = canvas;
  this.ctx.solution = ctx || canvas.getContext("2d");
};

MazeRenderer.prototype.render = function () {
  this.renderBackground();
  this.renderWalls();
  this.renderSolution();
};

MazeRenderer.prototype.renderBackground = function () {
  if (!this.canvas.background || !this.ctx.background) {
    return;
  }
  var canvas = this.canvas.background;
  var ctx = this.ctx.background;
  var info = this._drawingInfo(canvas, ctx);

  ctx.clearRect(0, 0, info.width, info.y - 1);
  ctx.clearRect(0, 0, info.x - 1, info.height);
  ctx.clearRect(0, info.y + info.drawingHeight, info.width, info.height);
  ctx.clearRect(info.x + info.drawingWidth, 0, info.width, info.height);

  for (var i = 0; i < info.rows; i++) {
    var rowOffset = info.y + i * info.cellHeight;
    var row = [];
    for (var j = 0; j < info.cols; j++) {
      var colOffset = info.x + j * info.cellWidth;

      var cell = this.maze.get(i, j);
      this.renderCellBackground(ctx, cell, colOffset, rowOffset, info.cellWidth, info.cellHeight);
    }
  }
};

MazeRenderer.prototype.renderWalls = function () {
  if (!this.canvas.walls || !this.ctx.walls) {
    return;
  }
  var canvas = this.canvas.walls;
  var ctx = this.ctx.walls;
  var info = this._drawingInfo(canvas, ctx);

  ctx.clearRect(0, 0, info.width, info.height);
  ctx.lineWidth = this.config.walls.lineWidth;
  ctx.strokeStyle = this.config.walls.style;

  var rowsArray = [];
  var colsArray = [];

  ctx.beginPath();

  for (var i = 0; i < info.rows; i++) {
    var row = [];
    for (var j = 0; j < info.cols; j++) {
      if (i === 0) {
        colsArray.push([]);
      }
      var cell = this.maze.get(i, j);

      row.push(cell);
      colsArray[j].push(cell);
    }
    rowsArray.push(row);
  }

  renderRow(ctx, rowsArray[0], Direction.N, 0, info.x, info.y, info.cellWidth, info.cellHeight);
  rowsArray.forEach(function (row, index) {
    renderRow(ctx, row, Direction.S, index + 1, info.x, info.y, info.cellWidth, info.cellHeight);
  });

  renderCol(ctx, colsArray[0], Direction.W, 0, info.x, info.y, info.cellWidth, info.cellHeight);
  colsArray.forEach(function (col, index) {
    renderCol(ctx, col, Direction.E, index + 1, info.x, info.y, info.cellWidth, info.cellHeight);
  });

  ctx.stroke();
};

MazeRenderer.prototype.renderSolution = function () {
  if (!this.canvas.solution || !this.ctx.solution) {
    return;
  }
  var canvas = this.canvas.solution;
  var ctx = this.ctx.solution;
  var info = this._drawingInfo(canvas, ctx);

  ctx.clearRect(0, 0, info.width, info.height);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'blue';

  renderConnected(ctx, this.maze, info.x, info.y, info.drawingWidth, info.drawingHeight, function (cell) {
    return cell.isMarkedVisited();
  });
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#33FF00';
  renderConnected(ctx, this.maze, info.x, info.y, info.drawingWidth, info.drawingHeight, function (cell) {
    return cell.isMarkedSolution();
  });
};

MazeRenderer.prototype._drawingInfo = function (canvas, ctx) {
  var width = canvas.width;
  var height = canvas.height;
  var rows = this.maze.rows();
  var cols = this.maze.cols();
  var drawingWidth = width - this.padding * 2;
  drawingWidth = Math.round(drawingWidth / cols) * cols;
  var drawingHeight = height - this.padding * 2;
  drawingHeight = Math.round(drawingHeight / rows) * rows;
  var cellWidth = Math.floor(drawingWidth / cols);
  var cellHeight = Math.floor(drawingHeight / rows);
  x = (width - drawingWidth) / 2;
  y = (height - drawingHeight) / 2;
  return {
    x: x,
    y: y,
    width: width,
    height: height,
    drawingWidth: drawingWidth,
    drawingHeight: drawingHeight,
    rows: rows,
    cols: cols,
    cellWidth: cellWidth,
    cellHeight: cellHeight
  };
};

MazeRenderer.prototype.renderCellBackground = function (ctx, cell, x, y, width, height) {
  if (!this.backgroundCacheNeedsUpdate(cell, x, y, width, height)) {
    return;
  }
  this.updateBackgroundCache(cell, x, y, width, height);

  ctx.clearRect(x, y, width, height);

  if (cell.isMarkedCurrent()) {
    renderSquare(ctx, x, y, width, height, "cyan");
  }
  else if (cell.isMarkedGenerated()) {
    renderSquare(ctx, x, y, width, height, "white");
  }
  else {
    renderSquare(ctx, x, y, width, height, this.config.walls.style);
  }
  if (cell.isStart()) {
    renderSquare(ctx, x, y, width, height, "lightgreen");
  }
  if (cell.isFinish()) {
    renderSquare(ctx, x, y, width, height, "red");
  }
};

MazeRenderer.prototype.emptyBackgroundCache = function () {
  var cache = {};
  this.maze.cells().forEach(function (cell) {
    if (!cache[cell.row]) {
      cache[cell.row] = {};
    }
    cache[cell.row][cell.col] = {};
  });
  return cache;
};

MazeRenderer.prototype.backgroundCacheNeedsUpdate = function (cell, x, y, width, height) {
  var cellCache = this.backgroundCache[cell.row][cell.col];
  if (cellCache.x !== x || cellCache.y !== y
    || cellCache.width !== width || cellCache.height !== height) {
    return true;
  }
  if (!cellCache.marks || cellCache.marks.length !== cell.marks.size) {
    return true;
  }
  if (!cellCache.marks.every(function (item) { return cell.marks.has(item) })) {
    return true;
  }
  if (cell.type !== cellCache.type) {
    return true;
  }
  return false;
};

MazeRenderer.prototype.updateBackgroundCache = function (cell, x, y, width, height) {
  var cellCache = this.backgroundCache[cell.row][cell.col];
  cellCache.x = x;
  cellCache.y = y;
  cellCache.width = width;
  cellCache.height = height;
  cellCache.marks = Array.from(cell.marks);
  cellCache.type = cell.type;
};

function renderRow(ctx, row, direction, index, x, y, width, height) {
  var offset = y + index * height;
  adjoinAndRender(row, direction, function (index1, index2) {
    renderLine(ctx, x + index1 * width, offset, x + index2 * width, offset);
  });
}

function renderCol(ctx, col, direction, index, x, y, width, height) {
  var offset = x + index * width;
  adjoinAndRender(col, direction, function (index1, index2) {
    renderLine(ctx, offset, y + index1 * height, offset, y + index2 * height);
  });
}

function adjoinAndRender(cells, direction, render) {
  var currentRunStart = null;
  for (var i = 0; i <= cells.length; i++) {
    var cell = cells[i];
    if (cell && cell.isClosed(direction)) {
      if (currentRunStart === null) {
        currentRunStart = i;
      }
    }
    else {
      if (currentRunStart !== null) {
        render(currentRunStart, i);
        currentRunStart = null;
      }
    }
  }
}

function renderConnected(ctx, maze, x, y, width, height, criteraCallback) {
  var cellWidth = Math.floor(width / maze.cols());
  var cellHeight = Math.floor(height / maze.rows());
  ctx.beginPath();
  for (var i = 0; i < maze.rows(); i++) {
    var rowOffset = y + cellHeight * i;
    for (var j = 0; j < maze.cols(); j++) {
      var colOffset = x + cellWidth * j;
      var cell = maze.get(i, j);
      if (criteraCallback(cell)) {
        renderCellConnections(ctx, maze, cell, colOffset, rowOffset, cellWidth, cellHeight, criteraCallback);
      }
    }
  }
  ctx.stroke();
}

function renderCellConnections(ctx, maze, cell, x, y, width, height, criteraCallback) {
  var centerX = x + width / 2;
  var centerY = y + height / 2;
  maze.openAdjacents(cell).forEach(function (adj) {
    if (criteraCallback(adj)) {
      var direction = cell.directionTo(adj);
      var offset = Direction.shift(0, 0, direction);
      var rowOffset = offset[0], colOffset = offset[1];
      renderLine(ctx,
        centerX,
        centerY,
        centerX + width / 2 * colOffset,
        centerY + height / 2 * rowOffset
      );
    }
  });
}

function renderLine(ctx, x, y, x2, y2) {
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
}

function renderCircle(ctx, x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();
}

function renderSquare(ctx, x, y, width, height, style) {
  var fillStyle = ctx.fillStyle;
  ctx.fillStyle = style;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = fillStyle;
}
function generatePaths(maze) {
  var delay = 100 / Math.max(maze.rows(), maze.cols());
  var start = maze.randomEdge().setStart();
  return generateMazeTree(maze, start, delay).then(function () {
    return pickFinish(maze, start, delay);
  });
}

function generateMazeTree(maze, start, delay) {
  var mazeSize = maze.rows() * maze.cols();
  var visited = new Set();
  var current = start;
  var lastVisited = null;
  return asyncLoop(function (_, finish) {
    if (visited.has(current.id)) {
      return;
    }
    visited.add(current.id);
    if (lastVisited) {
      lastVisited.unmarkCurrent();
    }
    lastVisited = current.markGenerated().markCurrent();
    if (visited.size == mazeSize) {
      current.unmarkCurrent();
      return finish();
    }
    var adjacents = maze.adjacents(current);
    var unvisitedAdjacents = adjacents.filter(function (adj) {
      return !visited.has(adj.id);
    });
    if (!unvisitedAdjacents.length) {
      var visitedArray = Array.from(visited);
      while (!unvisitedAdjacents.length) {
        current = maze.getById(randomArrayItem(visitedArray));
        unvisitedAdjacents = maze.adjacents(current).filter(function (adj) {
          return !visited.has(adj.id);
        });
      }
    }
    var next = randomArrayItem(unvisitedAdjacents);
    maze.openBetween(current, next);
    current = next;
  }, null, delay);
}

function pickFinish(maze, start, delay) {
  maze.randomEdge(start).setFinish();
}
var SOLVING_ALGORITHMS = {
  "astar": solveMazeAStar,
  "backtracking": solveMazeBacktracking,
  "breadth-first": solveMazeBreadthFirst,
  "depth-first": solveMazeDepthFirst
};

function solveMaze(maze, algorithm, visited) {
  var delay = 500 / Math.max(maze.rows(), maze.cols());

  return SOLVING_ALGORITHMS[algorithm](maze, visited, delay);
}

function solveMazeBreadthFirst(maze, visited, delay) {
  var start = maze.findStart();
  var open = [start];

  return asyncLoop(function (_, finish) {
    if (!open.length) {
      throw new Error("Exhausted search.");
    }

    var current = open.splice(0, 1)[0].markVisited();
    if (visited.has(current.id)) {
      return;
    }
    visited.add(current.id);

    if (current.isFinish()) {
      return finish();
    }

    var openAdjacents = maze.openAdjacents(current);
    Array.prototype.push.apply(open, openAdjacents);
  }, null, delay);
}

function solveMazeDepthFirst(maze, visited, delay) {
  var start = maze.findStart();
  var open = [start];

  return asyncLoop(function (_, finish) {
    if (!open.length) {
      throw new Error("Exhausted search.");
    }

    var current = open.splice(0, 1)[0].markVisited();
    if (visited.has(current.id)) {
      return;
    }
    visited.add(current.id);

    if (current.isFinish()) {
      return finish();
    }

    var openAdjacents = maze.openAdjacents(current);
    Array.prototype.unshift.apply(open, openAdjacents);
  }, null, delay);
}

function solveMazeBacktracking(maze, visited, delay) {
  var start = maze.findStart();
  var current = start;

  var backtracking = false;
  return asyncLoop(function (_, finish) {
    if (backtracking) {
      var openAdjacents = maze.openAdjacents(current);
      var unvisitedAdjacents = openAdjacents.filter(function (adj) {
        return !visited.has(adj.id);
      });

      if (unvisitedAdjacents.length) {
        backtracking = false;
        return;
      }
      current.unmarkSolution();

      var solutionAdjacents = openAdjacents.filter(function (adj) {
        return adj.isMarkedSolution();
      });

      if (solutionAdjacents.length !== 1) {
        throw new Error("Backtracked all the way, could not find any solution (or an invariant was violated)");
      }

      current = solutionAdjacents[0];
    }
    else {
      current.markVisited().markSolution();
      visited.add(current.id);

      if (current.isFinish()) {
        return finish();
      }

      var openAdjacents = maze.openAdjacents(current);
      var unvisitedAdjacents = openAdjacents.filter(function (adj) {
        return !visited.has(adj.id);
      });

      if (!unvisitedAdjacents.length) {
        backtracking = true;
        current.unmarkSolution();
      }
      else {
        current = randomArrayItem(unvisitedAdjacents);
      }
    }
  }, null, delay);
}

function solveMazeAStar(maze, visited, delay) {
  var start = maze.findStart();
  var finish = maze.findFinish();

  var open = [aStarNode(start, null, finish)];
  return asyncLoop(function (_, finishLoop) {
    if (!open.length) {
      throw new Error("Exhausted search.");
    }

    var current = open.splice(0, 1)[0];
    current.node.markVisited();
    visited.add(current.node.id);

    if (current.node.isFinish()) {
      return aStarMarkSolution(current, delay).then(finishLoop);
    }

    var openAdjacents = maze.openAdjacents(current.node);

    for (var i = 0; i < openAdjacents.length; i++) {
      var adj = openAdjacents[i];
      if (visited.has(adj.id)) {
        continue;
      }

      var adjNode = aStarNode(adj, current, finish);

      var sameOpen = open.findIndex(function (n) {
        return n.node.id === adj.id
      });
      if (sameOpen > -1) {
        if (open[sameOpen].cost < adjNode.cost) {
          continue;
        }
        else {
          open.splice(sameOpen, 1);
        }
      }

      aStarInsertByCost(open, adjNode);
    }
  }, null, delay);
}

function aStarInsertByCost(open, node) {
  for (var i = 0; i < open.length; i++) {
    var openNode = open[i];
    if (openNode.cost > node.cost) {
      open.splice(i, 0, node);
      return;
    }
  }

  open.push(node);
}

function aStarMarkSolution(finishNode, delay) {
  var current = finishNode;
  return asyncLoop(function (_, finish) {
    if (!current) {
      return finish();
    }

    current.node.markSolution();
    current = current.parent;
  }, null, delay);
}

function aStarNode(node, parent, finish) {
  var total = parent ? parent.totalCost + parent.node.squaredDistanceTo(node) : 0;
  var estimate = node.squaredDistanceTo(finish);

  return {
    parent: parent,
    node: node,
    cost: total + estimate,
    totalCost: total,
    estimatedCost: estimate,
  };
}

var backgroundCanvas = document.getElementById("maze-bg");
var wallsCanvas = document.getElementById("maze-walls");
var solutionCanvas = document.getElementById("maze-solution");

var maze;
var renderer;
var pathsPromise;
var solverPromise = null;
generate();

function generate() {
  cancelGenerate();
  cancelSolve();

  var size = document.getElementById('size').value;
  maze = new Maze(size, size);

  renderer = new MazeRenderer(maze);
  renderer.setBackgroundCanvas(backgroundCanvas);
  renderer.setWallsCanvas(wallsCanvas);
  renderer.setSolutionCanvas(solutionCanvas);

  pathsPromise = generatePaths(maze);
}
document.getElementById('generate').addEventListener('click', generate);

function solve() {
  if (solverPromise) {
    //TODO: Make solving cancellable
    return;
  }

  setSolveStatus("Waiting for generator to finish...");

  var visited;
  var updateInterval;
  var aborted = false;
  solverPromise = modifiedPromise(new Promise(function (resolve, reject) {
    pathsPromise.then(function () {
      if (aborted) {
        return;
      }

      maze.visitedCells().forEach(function (cell) {
        cell.unmarkVisited().unmarkSolution();
      });

      setSolveStatus("Solving...");
      updateInterval = setInterval(function () {
        setSolveStatus("Solving... (steps: " + Array.from(visited).length + ")");
      }, 500);

      var algorithm = document.getElementById('solver-algorithm').value;
      visited = new Set();
      resolve(solveMaze(maze, algorithm, visited));
    }).catch(reject);
  }), function () {
    aborted = true;
    clearInterval(updateInterval);
  }).then(function () {
    clearInterval(updateInterval);
    setSolveStatus("Solved in " + Array.from(visited).length + " steps.");
    solverPromise = null;
  });
}
document.getElementById('solve').addEventListener('click', solve);

function cancelGenerate() {
  if (pathsPromise) {
    pathsPromise.abort();
  }
}

function cancelSolve() {
  if (solverPromise) {
    setSolveStatus("Solve cancelled.");
    solverPromise.abort();
    solverPromise = null;
  }
  else {
    setSolveStatus("");
  }
}

function setSolveStatus(string) {
  document.getElementById('solve-status').textContent = string;
}

function render() {
  if (renderer) {
    renderer.render();
  }
}

function loop() {
  window.requestAnimationFrame(loop);

  render();
}
loop();

function resizeCanvas() {
  var canvases = document.getElementsByTagName('canvas');
  for (var i = 0; i < canvases.length; i++) {
    var cnvs = canvases[i];

    var style = window.getComputedStyle(cnvs);
    var width = parseInt(style.getPropertyValue('width'), 10);
    var height = parseInt(style.getPropertyValue('height'), 10);

    cnvs.width = width;
    cnvs.height = height;
  }
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);