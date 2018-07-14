(function () {

class PaintBrush {
	constructor () {
		this.x = 0;
		this.y = 0;
		this.color = new Rgb(0, 0, 0);
		this.thickness = 2;
	}
}

class Point {
	/**
	 * @param {number} x
	 * @param {number} y
	**/
	constructor (x, y) {
		this.x = x;
		this.y = y;
	}
}

class Rgb {
	/**
	 * @param {number} r
	 * @param {number} g
	 * @param {number} b
	**/
	constructor (r, g, b) {
		this.r = r;
		this.g = g;
		this.b = b;
	}
}

/**
 * @template T
**/
class UndoStack {

	/**
	 * @param {(number?)=} maxLen
	**/
	constructor (maxLen) {
		/** @type {Array<T>!} */ this._stack = [];
		this._cur = -1;
		this._maxLen = maxLen;
	}
	
	hasRedo () {
		return this._cur + 1 < this._stack.length;
	}
	
	hasUndo () {
		return this._cur >= 1;
	}
	
	/**
	 * @return {T?}
	**/
	peek () {
		return (this._cur >= 0) ? this._stack[this._cur] : null;
	}
	
	/**
	 * @param {T} t
	**/
	push (t) {
		this._stack[++this._cur] = t;
		// if we undo a few times and then add a new state to the stack, then we can longer do any redos,
		// so this becomes our new top
		this._stack.length = this._cur + 1;
		if (this._maxLen != null && this._stack.length > this._maxLen) this._shift();
	}
	
	/**
	 * @return {T?}
	**/
	redo () {
		return (this._cur + 1 < this._stack.length) ? this._stack[++this._cur] : null;
	}
	
	/**
	 * @return {T?}
	**/
	undo () {
		return (this._cur >= 1) ? this._stack[--this._cur] : null;
	}
	
}

class PaintDemo {

	constructor (prefix) {
		// allow a different class prefix to be used to avoid conflicts
		if (prefix == null) prefix = 'paint';
		this._canvas = document.querySelector('.' + prefix + '-canvas');
		this._context = this._canvas.getContext('2d');
		this._brush = new PaintBrush();
		this._undoStack = new UndoStack(10);
		this._savedPoints = [];
		this._colorSelect = document.querySelector('.' + prefix + '-color-select');
		this._thicknessSelect = document.querySelector('.' + prefix + '-thickness-select');
		this._undoButton = document.querySelector('.' + prefix + '-undo-button');
		this._redoButton = document.querySelector('.' + prefix + '-redo-button');
	
		this._canvas.addEventListener('mousedown', this._handleMouseDown.bind(this));
		window.addEventListener('mousemove', this._handleMouseMove.bind(this));
		window.addEventListener('mouseup', this._handleMouseUp.bind(this));
		this._colorSelect.addEventListener('change', this._updateColorFromUi.bind(this));
		this._thicknessSelect.addEventListener('change', this._handleThicknessSelectChange.bind(this));
		document.querySelector('.' + prefix + '-clear-button').addEventListener('click', this._clear.bind(this));
		this._undoButton.addEventListener('click', this._undo.bind(this));
		this._redoButton.addEventListener('click', this._redo.bind(this));
		
		this._context.lineCap = 'round';
		this._context.lineJoin = 'round';
		
		this._updateColorFromUi();
		this._updateThicknessFromUi();
		this._updateUndoRedoButtons();
		
		// We must add the initial state since the undoStack holds the *current* state
		this._undoStack.push(this._getImageData());
	}

	_clear () {
		this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
		this._undoStack.push(this._getImageData());
	}
	
	_getImageData () {
		return this._context.getImageData(0, 0, this._canvas.width, this._canvas.height);
	}
	
	_getStrokeStyle () {
		return "rgb(" + this._brush.color.r + "," + this._brush.color.g + "," + this._brush.color.b + ")";
	}

	_handleMouseDown (event) {
		// save image data, set globalalpha to lighter color
		// initialize array of line values for drawing later
	
		var point = this._windowToCanvas(event.clientX, event.clientY);
		this._savedPoints = [point];
	
		this._context.lineWidth = this._brush.thickness;
		this._context.strokeStyle = this._getStrokeStyle();
		this._context.beginPath();
		// moving so that we don't have to remember this point as our starting point for the next mouse event
		this._context.moveTo(point.x, point.y);	
	}
	
	_handleMouseMove (event) {
		if (!this._savedPoints.length) return;
		var point = this._windowToCanvas(event.clientX, event.clientY);
		this._savedPoints.push(point);
		// Note: we draw the line in increments as we're drawing to avoid having to redraw the whole line too quickly,
		// but then on mouse up, we redraw the whole path and stroke it once.
		this._context.lineTo(point.x, point.y);
		this._context.stroke();
		this._context.beginPath();
		this._context.moveTo(point.x, point.y);
	}
	
	_handleMouseUp (event) {
		if (!this._savedPoints.length) return;
		// reset the globalalpha property
		// put the old image data back
		// and then drawing the new line
		
		this._savedPoints.push(this._windowToCanvas(event.clientX, event.clientY));
	
		var lastImageData = this._undoStack.peek();
		if (lastImageData) {
			this._context.putImageData(lastImageData, 0, 0);
		}
		this._context.strokeStyle = this._getStrokeStyle();
		// redraw the line in full opacity
		this._context.beginPath();
		this._context.moveTo(this._savedPoints[0].x, this._savedPoints[0].y);
		for(var i = 1; i < this._savedPoints.length; i++){
			this._context.lineTo(this._savedPoints[i].x, this._savedPoints[i].y);
		}
		this._savedPoints.length = 0;
		this._context.stroke();
		this._context.closePath();
		this._undoStack.push(this._getImageData());
		this._updateUndoRedoButtons();
	}
	
	_handleThicknessSelectChange (e) {
		this._updateThicknessFromUi();
	}

	_redo () {
		// always leave one image in the stack
		var imageData = this._undoStack.redo();
		if (imageData) {
			this._context.putImageData(imageData, 0, 0);
			this._updateUndoRedoButtons();
		}
	}
	
	_undo () {
		var imageData = this._undoStack.undo();
		if (imageData) {
			this._context.putImageData(imageData, 0, 0);
			this._updateUndoRedoButtons();
		} else {
			this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
		}
	}
	
	_updateColorFromUi () {
		var colorChoice = this._colorSelect.options[this._colorSelect.selectedIndex].value;
		this._brush.color.r = parseInt(colorChoice.substring(1, 3), 16);
		this._brush.color.g = parseInt(colorChoice.substring(3, 5), 16);
		this._brush.color.b = parseInt(colorChoice.substring(5, 7), 16);
	}
	
	_updateThicknessFromUi () {
		this._brush.thickness = this._thicknessSelect.options[this._thicknessSelect.selectedIndex].value;
	}
	
	_updateUndoRedoButtons () {
		this._undoButton.disabled = !this._undoStack.hasUndo();
		this._redoButton.disabled = !this._undoStack.hasRedo();
	}

	_windowToCanvas (x, y) {
		var rect = this._canvas.getBoundingClientRect();
		return new Point(
			x - rect.left * (this._canvas.width / (rect.width ? rect.width : (rect.right - rect.left))),
			y - rect.top * (this._canvas.height / (rect.height ? rect.height : (rect.bottom - rect.top)))
		);
	}
	
}

window.addEventListener('load', function () {
	(new PaintDemo());
});

}());