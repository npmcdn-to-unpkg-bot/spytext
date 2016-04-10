/**
 * A Backbone.View for Spytext fields. 
 *
 * @module spytext/field 
 */

var Snapback = require('snapback');
var SpytextToolbar = require('./toolbar');

var selektr = require('selektr');
var commands = require('./commands');
	
var assign = require('lodash/assign'),
	toArray = require('lodash/toArray'),
	tail = require('lodash/tail');
/**
 * @readonly
 */
var blockTags = [ 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI' ];      

module.exports = require('ridge/view').extend({
	/**
	 * @lends SpytextField.prototype
	 */
	events: assign({
		focus: 'activate',

		blur: 'deactivate',
	}, require('./events')),

	/**
	 * @constructs
	 * @augments Backbone.View
	 */
	initialize: function() {
		var _view = this;
		this.$el.addClass('spytext-field').attr('contentEditable', 'true');

		commands.deleteEmptyTextNodes(this.el);
		commands.deleteEmptyElements(this.el);
		if($(this.el).is(':empty')) {
			$(this.el).append('<p>');
		}
		commands.setBR(toArray(this.el.children));

		this.originalValue = this.el.innerHTML;

		this.toolbar = new SpytextToolbar();

		$(document.body).append(this.toolbar.el);

		this.snapback = new Snapback(this.el, {
			/**
			 * Saves and returns the positions of the current selection
			 *
			 * @return {Positions}
			 */
			store: function(data) {
				return (this.data = (data || selektr.get()));
			},

			restore: function(data) {
				this.store(data);

				selektr.restore(data, true);
			},
		});
	},

	/**
	 * Activates the current field.
	 */
	activate: function() {
		var _field = this;

		// enable snapback, ie. tell the snapback instance's
		// mutationObserver to observer
		_field.snapback.enable();

		// toggle the toolbar, passing the current field to it
		_field.toolbar.toggle(_field);

		selektr.setElement(_field.el);

		// i think the timeout is because of the range not being initialized
		// so snapback.storePositions/selektr produces an error
		setTimeout(function() {
			_field.snapback.store();

			// this is to capture events when mousedown on 
			// fields element but mouseup outside
			$(document).on('mousedown', function(e) {
				clearTimeout(this.timeout);
				_field.snapback.register();
			});
			$(document).on('mouseup', function(e) {
				setTimeout(function() {
					selektr.normalize();
					selektr.update();
					_field.toolbar.setActiveStyles();
					_field.snapback.store();
				});
			});
		});
	},

	/**
	 * Deactivates the current field.
	 */
	deactivate: function() {
		// register mutations (if any) as an undo before deactivating
		this.snapback.register();

		// disable snapback, ie. disconnect the mutationObserver
		this.snapback.disable();

		// deactivate toolbar
		this.toolbar.toggle();

		// stop listening to mouseup and mousedown on document
		$(document).off('mouseup');
		$(document).off('mousedown');
	},

	render: function() {
		if(!this.el.firstChild) {
			this.$el.append('<p><br></p>');
		}
	},

	/**
	 * Calls a command from module:spytext/commands
	 *
	 * @see module:spytext/commands
	 */
	command: function(command) {
		var field = this;

		// register mutations (if any) as undo before calling command
		// so that the command becomes it's own undo without merging
		// it with any previous mutations in the mutation array in snapback
		field.snapback.register();

		if(commands[command]) {
			// call the command
			commands[command].apply(null,  [ field.el ].concat(tail(arguments)));

			// normalize any text nodes in the field's element
			field.el.normalize();

			$(field.el).trigger('change');
			// unfortunately, we need to wrap the registation of a new Undo
			// in a timeout
			setTimeout(function(){
				// register the called command as an undo
				field.snapback.register();
				field.toolbar.setActiveStyles();
			});
		}
	},
});