// MOD extensions
(function() {
	var assign = MOD.assign;

	var p = Element.prototype;
	assign(p, 'tidy', function(tagName) {
		var that = this;
		tagName = tagName || this.tagName;
		function recurse(node, isEmptied, isRecursed, tagNode) {
			if(!node) return;

			if(!isRecursed && node.firstChild) {
				if(!isEmptied && node.tagName === tagName) {
					node.emptyNested();
					isEmptied = true;
				}
				recurse(node.firstChild, isEmptied, false, null);
			}

			if(node === that) return;

			var next = node.nextSibling;

			if(!isRecursed && next) {
				recurse(next, false, false, null);
			}

			if(next && next.nodeType === 1 && node.nodeType === 1 && next.isInline() && (tagNode || node.isInline())) {
				var tagNext = next.getTag(tagName);
				if(!tagNext) return recurse(next, isEmptied, true);

				if(!tagNode) {
					tagNode = node.getTag(tagName);
					if(!tagNode) return recurse(next, isEmptied, true, tagNext);
				}

				if(tagNode === node) {
					if(tagNext === next) {
						while(next.firstChild) {
							node.append(next.firstChild);
						}
						next.vanish();
					} else {
						node.append(next);
						tagNext.unwrap();
					}
					return recurse(node, isEmptied, true, tagNode);
				} else {
					if(tagNext === next) {
						next.prepend(node);
						tagNode.unwrap();
						return recurse(next, isEmptied, true, next);
					} else {
						var tmp = O('<' + tagName + '></' + tagName + '>');
						node.before(tmp);
						tmp.append(node);
						tmp.append(next);
						tagNode.unwrap();
						tagNext.unwrap();
						return recurse(tmp, isEmptied, true, tmp);
					}
				}
			}
			recurse(next, isEmptied, true, null);
		}
		recurse(this, false, false, null);
		this.normalize();
		recurse(this, false, false, null);
		this.normalize();
		this.setBR();
		return this;
	});
	assign(p, 'setBR', function() {
		if(this.firstChild && this.firstChild === this.lastChild && this.firstChild.textContent.length === 0) this.removeChild(this.firstChild);
		if(!this.firstChild) this.appendChild(O('<BR>'));
		else {
			var br = this.getElementsByTagName('BR');
			var length = br.length;
			for(var i = 0; i < length; i++) {
				if(br[i].previousSibling) {
					br[i].vanish();
					i--;
					length--;
				}
			}
		}
	});
	assign(p, 'unwrap',  function() {
		var nodes = [];
		while(this.lastChild) {
			nodes.push(this.lastChild);
			this.after(this.lastChild);
		}
		this.vanish();
		return M(nodes);
	});
	assign(p, 'emptyNested', function(tagName) {
		// TODO make it so you can delete by selector as well
		tagName = tagName || this.tagName;
		var nested = M(this.getElementsByTagName(tagName));
		nested.each(function(element) {
			this.unwrap();
		});
	});
	assign(p, 'isTag', function(tagName) {
		return this.tagName === tagName;
	});
	assign(p, 'getTag', function(tagName) {
		// TODO make it so you can delete by selector as well
		tagName = tagName || this.tagName;
		var tag = null;
		if(this.tagName === tagName) {
			return this;
		}
		var tmp = this;
		while(tmp.firstChild && tmp.firstChild === tmp.lastChild) {
			if(tmp.tagName === tagName) {
				return tmp;
			}
			tmp = tmp.firstChild;
		}
		return null;
	});

	p = Node.prototype;
	assign(p, 'ancestors', function(ufo, stop) {
		var ancestors = [];
		var node = this.closest(ufo, stop);
		while(node) {
			ancestors.push(node);
			node = node.closest(ufo, stop);
		}
		return M(ancestors);
	});
	assign(p, 'isBlock', function() {
		return this && this.nodeType === 1 && !getComputedStyle(this).display.match(/inline/);
	});
	assign(p, 'isInline', function() {
		return this && (this.nodeType === 3 || !getComputedStyle(this).display.match(/inline/));
	});
})();
var Spytext = (function() {
	var Spytext = function(element, config) {
		var that = this;
		this.fields = [];
		//this.currentField = null;
		// holds the active, if any, field
		this.field = null;
		this.element = null;
		this.snapback = null;
		this.selectron = null;
		this.buttons = {};
		this.dropdowns = {};
		this.toolbar = null;
		_.each(this.events.doc, function(func, name) {
			document.bind(name, func, that);
		});
		//this.mousedown = false;
		if(element) {
			var toolbar = element.O('[spytext-toolbar], .spytext-toolbar');
			if(toolbar) this.toolbar = new SpytextToolbar(toolbar, { preset: 'standard' });
			element.M('[spytext-field], .spytext-field').each(function() {
				that.addField(this, { preset: 'full' });
			});
			element.M('[st-button-type]').each(function() {
				that.addButton(this, { preset: this.attr('st-button-type') });

			});
			element.M('[st-dropdown-type]').each(function() {
				that.addDropdown(this, { preset: this.attr('st-dropdown-type') });
			});
		}
	};
	Spytext.prototype = {
		enableToolbar: function() {
			for(var i in this.buttons) {
				var button = this.buttons[i];
				//button.element.setAttribute('disabled');
				button.enable();
			}
			for(var j in this.dropdowns) {
				this.dropdowns[j].enable();
				//button.element.setAttribute('disabled');
			}
		},
		disableToolbar: function() {
			for(var i in this.buttons) {
				this.buttons[i].disable();
				this.buttons[i].unsetActive();
			}
			for(var j in this.dropdowns) {
				this.dropdowns[j].disable();
			}
		},
		setActiveStyles: function() {
			function setBlock(tag) {
				switch(tag) {
					case 'P':
					case 'H1':
					case 'H2':
					case 'H3':
					case 'H4':
					case 'H5':
					case 'H6':
						that.dropdowns.type.setActive({ tag: tag });
						break;
					case 'UL':
						that.buttons.unorderedList.setActive();
						that.dropdowns.type.setNoActive();
						break;
					case 'OL':
						that.buttons.orderedList.setActive();
						that.dropdowns.type.setNoActive();
						break;
				}
			}
			var that = this;
			var tags = [];
			var blocks = [];
			var rng;
			while(!rng) {
				rng = this.selectron.range();
			}
			if(rng.collapsed) {
				tags = rng.startContainer.ancestors(null, this.element).toArray();
				if(tags.length > 0) blocks.push(tags.pop());
			} else {
				var el = rng.commonAncestorContainer;
				tags = el.ancestors(null, this.element).toArray();
			}
			tags = M(tags);

			for(var i in this.buttons) {
				var button = this.buttons[i];
				if(button.config.options && tags.includes(button.config.options.tag)) {
					button.setActive();
				} else button.unsetActive();
			}
			var blockTag;
			for(var j = 0; j < blocks.length; j++) {
				if(blockTag && blockTag !== blocks[j].tagName) {
					blockTag = null;
					break;
				} else {
					blockTag = blocks[j].tagName || null;
				}
			}
			if(blockTag) setBlock(blockTag);
		},
		setCurrentField: function(field) {
			if(this.fields.indexOf(field) > -1) {
				this.field = field;
				this.element = field.element;
				this.snapback = field.snapback;
				this.selectron = field.selectron;
				this.enableToolbar();
				// TODO activate buttons
			} else {
				this.unsetCurrentField();
			}
		},
		unsetCurrentField: function() {
			this.field = this.element = this.snapback = this.selectron = null;
			this.disableToolbar();
			// TODO deactivate buttons
		},
		events: {
			doc: {
				mouseup: function(e) {
					var that = this;
					if(this.field) {
						this.snapback.register();
						setTimeout(function() {
							that.setActiveStyles();
						}, 10);
					}
					//this.mousedown = false;
				}
			}
		},
		actions: {
			align: function(options) {

				var containedChildren = this.selectron.contained(1,1);
				containedChildren.each(function() {
					if(!this.matches('ul, ol')) this.css('text-align', options.alignment);
				});
			},
			block: function(options) {
				function block(node, insertBefore) {
					insertBefore = insertBefore || node;
					var tmp = wrapper.clone();
					insertBefore.before(tmp);
					while(node.firstChild) {
						tmp.append(node.firstChild);
					}
					node.vanish();
					tmp.setBR();
					blocks.push(tmp);
				}
				var that = this;
				var positron = this.selectron.get(true);
				var wrapper = O('<' + options.tag + '></' + options.tag + '>');

				var blocks = [];
				this.selectron.contained(1, 1).each(function(){
					var child = this;
					if(this.nodeName === 'UL' || this.nodeName === 'OL') {
						var li = this.offspring('li');
						var containedLi = that.selectron.contained(li);
						var startIndex = li.indexOf(containedLi[0]);
						containedLi.each(function() {
							block(this, child);
						});

						if(!this.firstChild) this.vanish();
						else if(startIndex > 0) {
							var bottomList = O('<' + this.tagName + '><' + this.tagName + '/>');
							while(startIndex < this.childNodes.length) {
								this.after(bottomList);
								bottomList.prepend(this.lastChild);
							}
							this.after(M(blocks));
						}
					} else {
						block(this);
					}
				});
				positron.restore();
			},
			deleteRangeContents: function(rng) {
				function removeNodes(node, startNode) {
					startNode = startNode || node;
					var next;
					var tmp = node;
					while(!next && tmp && tmp !== startBlock) {
						if(tmp.nextSibling) next = tmp.nextSibling;
						else tmp = tmp.parentNode;
					}
					if(node && startNode !== node) {
						node.vanish();
					}
					if(next) removeNodes(next, startNode);
				}
				function appendNodes(node, startNode) {
					startNode = startNode || node;
					var next;
					var tmp = node;
					while(!next && tmp && tmp !== endBlock) {
						if(tmp.nextSibling) next = tmp.nextSibling;
						else tmp = tmp.parentNode;
					}
					
					if(node && startNode !== node) {
						startBlock.appendChild(node);
					}
					if(next) appendNodes(next, startNode);
				}
				var that = this;
				var commonAncestor = rng.commonAncestorContainer;
				if(commonAncestor === this.element || (commonAncestor.nodeType === 1 && commonAncestor.matches('UL, OL'))) {
					var positron = this.selectron.get();
					var firstNode, lastNode;
					var startAncestors = rng.startContainer.ancestors(null, this.element).toArray();
					var startBlock = startAncestors.length > 0 ? _.last(startAncestors) : this.element.firstChild;
					var completelyContainedBlocks = this.selectron.contained(1, 1, true);
					if(this.selectron.contained(M(startBlock), null, true).length > 0) {
						startBlock.empty();
					} else {
						if(startBlock.firstChild.tagName === 'LI') {
							this.selectron.contained(startBlock.childNodes, null, true).vanish();
							startBlock = rng.startContainer.closest('LI', endBlock);
						}

						node = rng.startContainer;

						while(node && node.nodeType !== 3) node = node.firstChild;

						if(node) {
							node.splitText(rng.startOffset);
							firstNode = node;
							removeNodes(node);
						}
					}
					var endAncestors = rng.endContainer.ancestors(null, this.element).toArray();
					var endBlock = _.last(endAncestors);
					if(endBlock && this.selectron.contained(M(endBlock), null, true).length < 1) {
						var block;
						if(endBlock.firstChild.tagName === 'LI') {
							block = rng.endContainer.closest('LI', endBlock);
							this.selectron.contained(endBlock.childNodes, null, true).vanish();
						} else block = endBlock;

						var tmpPositron = positron.clone();
						tmpPositron.start = { ref: block, offset: 0, isAtStart: true };
						tmpPositron.restore();
						this.selectron.range().deleteContents();
						while(block.firstChild) {
							startBlock.appendChild(block.firstChild);
						}
						block.vanish();
						//positron.start = { ref: startBlock, offset: startBlock.textContent.length, isAtStart: startBlock.textContent.length === 0 };
						//positron.end = positron.start;
					}

					if(!startBlock.firstChild || startBlock.firstChild.textContent.length === 0 || startBlock.firstChild.textContent.match(/^\s+$/)) {
						if(startBlock.firstChild && (startBlock.firstChild.textContent.length === 0 || startBlock.firstChild.textContent.match(/^\s+$/))) {
							startBlock.firstChild.vanish();
						}
						if(startBlock.matches('UL, OL')) {
							var p = O('<p>');
							startBlock.before(p);
							startBlock.vanish();
							startBlock = p;
						}
						startBlock.setBR();
						positron.start = { ref: startBlock, offset: 0, isAtStart: true };
					}
					//completelyContainedBlocks = completelyContainedBlocks.toArray();
					//completelyContainedBlocks.shift();
					M(completelyContainedBlocks).vanish();
					positron.end = positron.start;
					positron.restore();
				} else {
					rng.deleteContents();
				}
			},
			join: function(node1, node2) {
				var positron = this.selectron.get(true);
				var pa = node2.parentNode;
				if(node1.matches('LI') && node2.matches('LI') && node1.closest('UL,OL') !== node2.closest('UL, OL')) {
					node1.after(M(pa.children));
					pa.vanish();
				} else {
					if(node1.lastChild.tagName === 'BR') node1.removeChild(node1.lastChild);
					if(node2.nodeType === 1 && node2.matches('UL, OL')) node2 = node2.firstChild;
					while(node2.firstChild) 
						node1.appendChild(node2.firstChild);
				}
				node1.setBR();
				if(!node2.firstChild || node2.textContent.length === 0) node2.vanish();
				else node2.setBR();
				if(!pa.firstChild) pa.vanish();
				node1.setBR();
				positron.restore();
			},
			newline: function() {
				var rng = this.selectron.range();
				var block = rng.startContainer.nodeType === 1 && rng.startContainer.matches('LI, P, H1, H3, H4, H5, H6') ? rng.startContainer : rng.startContainer.closest('LI, P, H1, H2, H3, H4, H5, H6', this.element);

				var positron = this.selectron.get(block, true);
				var contents;
				if(block.matches('LI') && block.textContent.length === 0) {
					// TODO check if there is ancestor LI, if so oudent instead
					this.actions.block.call(this, { tag: 'P' });
				} else {
					var el = O('<' + block.tagName + '>');
					block.after(el);
					if(positron.end.offset !== positron.end.ref.textContent.length) {
						positron.end = { ref: block, offset: block.textContent.length };
						positron.restore();
						contents = this.selectron.range().extractContents();
					}

					while(contents && contents.firstChild) 
						el.appendChild(contents.firstChild);

					el.setBR();
					block.setBR();

					this.selectron.set(el, 0);
				}
			},
			list: function(options){
				var that = this;
				var tags = {
					ordered: 'OL',
					unordered: 'UL'
				};
				var list = O('<' + options.tag + '></' + options.tag + '>');
				var positron = this.selectron.get(null, true);
				var containedChildren = this.selectron.contained(1, 1);
				if(containedChildren.length === 1 && containedChildren[0].tagName === options.tag) return;
				containedChildren[0].before(list);
				containedChildren.each(function(){
					if(this.nodeName === 'UL' || this.nodeName === 'OL') {
						var li = this.offspring('li');
						var containedLi = that.selectron.contained(li);
						var startIndex = li.indexOf(containedLi[0]);
						containedLi.each(function() {
								list.append(this);
						});

						if(!this.firstChild) this.vanish();
						else if(startIndex > 0) {
							var bottomList = O('<' + this.tagName + '><' + this.tagName + '/>');
							while(startIndex < this.childNodes.length) {
								this.after(bottomList);
								bottomList.prepend(this.lastChild);
							}
							this.after(list);
						}
					} else {
						var listItem = O('<li></li>');
						list.append(listItem);
						while(this.firstChild) {
							listItem.append(this.firstChild);
						}
						list.append(listItem);
						this.vanish();
					}
				});
				positron.restore();
			},
			indent: function(){
				var allLi = this.selectron.contained('li');
				var positron = this.selectron.get(null, true);
				for(var i = 0; i < allLi.length; i++) {
					//var add = allLi[i].closest('li', this.element);
					var listTag = allLi[i].closest('ul, ol', this.element).tagName;

					var prev = allLi[i].previousSibling;
					if(prev) {
						var nested = prev.offspring(listTag)[0];
						var list = nested || O('<' + listTag + '></' + listTag + '>');

						if(list !== nested) prev.append(list);

						list.append(allLi[i]);
					}
					//if(!add) add = allLi[i];
					//
					//if(li.indexOf(add) === -1) li.push
					//var prev = listItems[i].previousSibling;
					//if(prev) {
					//}
				}
				positron.restore();
			},
			format: function(options){
				var positron = this.selectron.get(null, true);
				// NodeList converted to Array to that we can splice it if needed
				var containedTextNodes = this.selectron.contained(3).toArray();
				var rng = this.selectron.range();
				if(rng.endOffset < rng.endContainer.textContent.length) {
					node = rng.endContainer;

					while(node.firstChild && node.nodeType !== 3) node = node.firstChild;

					if(node) node.splitText(rng.endOffset);
				}
				if(rng.startOffset > 0) {
					node = rng.startContainer;

					while(node && node.nodeType !== 3) node = node.firstChild;

					if(node) containedTextNodes.splice(0, 1, node.splitText(rng.startOffset));
				}
				M(containedTextNodes).wrap(options.container ? O(options.container).clone() : O('<' + options.tag + '></' + options.tag + '>'));
				this.selectron.contained(1, 1).tidy(options.container ? options.container.tagName : options.tag);
				positron.restore();
			},
			link: function(attribute) {
				var sel = window.getSelection();
				var node = sel.focusNode.parentNode;
				if (node.tagName.toLowerCase() !== 'a') {
					node = sel.anchorNode.parentNode;
					if (node.tagName.toLowerCase() !== 'a') {
						node = null;
					}
				}

				var href = 'http://';
				if (node) {
					var range = document.createRange();
					range.selectNodeContents(node);
					href = node.attributeibutes.href.value;
					sel.removeAllRanges();
					sel.addRange(range);
				}
				var result = prompt('Link address:', href);

				if (result !== '') {
					document.execCommand('createLink', null, result);
				} else {
					document.execCommand('unlink');
				}
			},
			paste: function(dataTransfer) {
				var rng = this.selectron.range();

				var str = dataTransfer.getData('Text');
				str = str.replace(/</g, '&lt;').replace(/>/, '&gt;').replace(/[\n\r]+$/g, '');
				var arr = str.split(/[\n\r]+/);

				var block = rng.startContainer.nodeType === 1 && rng.startContainer.matches('LI, H1, H2, H3, H4, H5, H6, P') ? rng.startContainer : rng.startContainer.closest('LI, H1, H2, H3, H4, H5, H6, P');
				var positron = this.selectron.get(block);
				var textNode;
				if(arr.length === 0) {
					return;
				} else if (arr.length === 1) {
					textNode = document.createTextNode(arr[0]);
					if(rng.startOffset === 0) {
						if(rng.startContainer.nodeType === 1) {
							if(rng.startContainer.lastChild.nodeName === 'BR')
								rng.startContainer.lastChild.vanish();
							rng.startContainer.prepend(textNode);
						} else rng.startContainer.parentNode.prepend(textNode);
					} else if (rng.startOffset === rng.startContainer.textContent.length) {
						if(rng.startContainer.nodeType === 1) rng.startContainer.append(textNode);
						else rng.startContainer.parentNode.append(textNode);
					} else {
						var node = rng.startContainer;
						node.splitText(rng.endOffset);
						node.after(textNode);
					}
					positron.start.offset = positron.start.offset + textNode.textContent.length;
					positron.end = positron.start;
				} else {
					positron.end = { ref: block, offset: block.textContent.length };
					positron.restore();

					var contents = this.selectron.range().extractContents();
					for(var i = arr.length - 1; i >= 0; i--) {
						textNode = document.createTextNode(arr[i]);
						if(i === 0) {
							if(block.lastChild.nodeName === 'BR')
								block.lastChild.vanish();
							block.append(textNode);
						} else {
							var el = O('<' + block.tagName + '>');
							el.append(textNode);
							if(i === arr.length - 1) {
								while(contents.firstChild) {
									el.append(contents.firstChild);
								}
								positron.start = { ref: el, offset: textNode.textContent.length, isAtStart: false };
								positron.end = positron.start;
							}
							block.after(el);
						}
					}
				}
				positron.restore();

				//document.execCommand('insertText', null, str);
			},
			removeFormat: function() {
				document.execCommand('removeFormat');
			}
		},
		addButton: function(element, config) {
			var button = new SpytextButton(element, config, this);
			this.buttons[config.preset] = button;
			return button;
		},
		addDropdown: function(element, config) {
			var dropdown = new SpytextDropdown(element, config, this);
			this.dropdowns[config.preset] = dropdown;
			return dropdown;
		},
		addField: function(element, config) {
			var field = new SpytextField(this, element, config);
			this.fields.push(field);
			return field;
		},
		execute: function(action, options) {
			var that = this;
			this.selectron.normalize();
			this.snapback.register();
			if(this.actions[action]) {
				this.actions[action].call(this, options);
				this.setActiveStyles();
				setTimeout(function() {
					that.snapback.register();
				}, 100);
			}
		}
	};
	var SpytextButton = function(element, config, spytext) {
		var that = this;
		this.spytext = spytext;
		this.config = typeof config.preset === 'string' ? _.merge(this.presets[config.preset], config) : config;
		this.element = element;
		_.each(this.events, function(func, name) {
			element.bind(name, func, that);
		});
		this.disable();
	};
	SpytextButton.prototype = {
		setActive: function() {
			this.element.addClass('active');
		},
		unsetActive: function() {
			this.element.removeClass('active');
		},
		enable: function() {
			this.element.disabled = false;
		},
		disable: function() {
			this.element.disabled = true;
		},
		events: {
			click: function(e) {
				e.preventDefault();
				this.spytext.execute(this.config.action, this.config.options);
			}
		},
		presets: {
			alignLeft: { title: 'Align Left', action: 'align', options: { alignment: 'left' }},
			alignRight: { title: 'Align Right', action: 'align', options: { alignment: 'right' }},
			alignCenter: { title: 'Align Center', action: 'align', options: { alignment: 'center' }},
			alignJustify: { title: 'Align Justify', action: 'align', options: { alignment: 'justify' }},
			bold: { title: 'Bold', action: 'format', options: { tag: 'B' }},
			strikeThrough: { title: 'Strike Through', action: 'format', options: { tag: 'STRIKE' }},
			underline: { title: 'Underline', action: 'format', options: { tag: 'U' }},
			italic: { title: 'Italic', action: 'format', options: { tag: 'I' }},
			removeFormat: { action: 'removeFormat' },
			typeHeading1: { title: 'Heading 1', action: 'block', options: { tag: 'H1' }},
			typeHeading2: { title: 'Heading 2', action: 'block', options: { tag: 'H2' }},
			typeHeading3: { title: 'Heading 3', action: 'block', options: { tag: 'H3' }},
			typeHeading4: { title: 'Heading 4', action: 'block', options: { tag: 'H4' }},
			typeHeading5: { title: 'Heading 5', action: 'block', options: { tag: 'H5' }},
			typeHeading6: { title: 'Heading 6', action: 'block', options: { tag: 'H6' }},
			typeParagraph: { title: 'Paragraph', action: 'block', options: { tag: 'P' }},
			orderedList: { title: 'Ordered List', action: 'list', options: { tag: 'OL' }},
			unorderedList: { title: 'Unordered List', action: 'list', options: { tag: 'UL' }},
			indent: { title: 'Indent', action: 'indent', options: { outdent: false }},
			outdent: { title: 'Outdent', action: 'indent', options: { outdent: true }}
		}
	};
	var SpytextDropdown = function(element, config, spytext) {
		var that = this;
		this.spytext = spytext;
		this.config = typeof config.preset === 'string' ? _.merge(this.presets[config.preset], config) : config;
		this.items = [];
		this.element = element;
		_.each(this.config.items, function(item) {
			var el = O('<li><span>' + item.title + '</span></li>');
			that.element.append(el);
			_.each(that.events.item, function(func, name) {
				el.bind(name, func, that);
			});
			that.items.push(item);
		});

		_.each(this.events.dropdown, function(func, name) {
			element.bind(name, func, that);
		});
		this.index = 0;
		this.length = this.element.offspring().length;
		this.disable();
	};
	SpytextDropdown.prototype = {
		setIndex: function(index) {
			this.index = index;
			var liHeight = this.element.first().offsetHeight;
			var children = this.element.offspring().toArray();
			for(var i = 0; i < children.length; i++) {
				children[i].css('top', '-' + (index * liHeight) + 'px');
				if(i === index) children[i].addClass('active');
				else children[i].removeClass('active');
			}
		},
		setNoActive: function() {
			this.index = 0;
			var children = this.element.offspring().toArray();
			for(var i = 0; i < children.length; i++) {
				children[i].css('top', '0');
				children[i].removeClass('active');
			}
		},
		setActive: function(options) {
			var arr = _.where(this.items, { options: options });
			var index = _.findIndex(this.items, function(item) {
				for(var i in options) {
					if(options[i] !== item.options[i])
						return false;
				}
				return true;
			});
			this.setIndex(index);
		},
		enable: function() {
			this.element.removeClass('disabled');
		},
		disable: function() {
			this.element.addClass('disabled');
			this.element.removeClass('expanded');
			this.setNoActive();
		},
		events: {
			dropdown: {
				click: function(e) {
					if(this.spytext.field) {
						this.element.toggleClass('expanded');
					}
				}
			},
			item: {
				click: function(e) {
					if(this.element.hasClass('expanded')) {
						var index = this.element.offspring().indexOf(e.currentTarget);
						this.spytext.execute(this.config.action, this.items[index].options);
					}
				}
			}
		},
		presets: {
			type: {
				action: 'block',
				items: [
					{ title: 'Heading 1', options: { tag: 'H1' }},
					{ title: 'Heading 2', options: { tag: 'H2' }},
					{ title: 'Heading 3', options: { tag: 'H3' }},
					{ title: 'Heading 4', options: { tag: 'H4' }},
					{ title: 'Heading 5', options: { tag: 'H5' }},
					{ title: 'Heading 6', options: { tag: 'H6' }},
					{ title: 'Paragraph', options: { tag: 'P' }}
				]
			}
		}
	};
	var SpytextToolbar = function(element, config) {
		var that = this;
		this.config = typeof config.preset === 'string' ? _.merge(this.presets[config.preset], config) : config;
		this.element = element;
		_.each(this.events, function(func, name) {
			that.element.bind(name, func, that);
		});
	};
	SpytextToolbar.prototype = {
		presets: {
			standard: {
				dropdowns: [ 'type' ],
				buttonGroups: [
					//{ name: 'block', buttons: ['typeHeading1', 'typeHeading2', 'typeHeading3', 'typeHeading4', 'typeHeading5', 'typeHeading6', 'typeParagraph']},
					{ name: 'format', buttons: ['bold', 'italic', 'underline', 'strikeThrough', 'removeFormat']},
					{ name: 'align', buttons: ['alignLeft', 'alignCenter', 'alignRight', 'alignJustify']},
					{ name: 'list', buttons: ['unorderedList', 'orderedList']},
					{ name: 'indent', buttons: ['indent', 'outdent']}
				]
			},
			format: {
				buttonGroups: [
					{ name: 'format', buttons: ['bold', 'underline', 'strikeThrough', 'removeFormat']},
				]
			}
		},
		events: {
			mousedown: function(e) {
				// this is needed to prevent toolbar from stealing focus
				e.preventDefault();
			}
		}
	};
	var SpytextField = function(spytext, element, config) {
		var that = this;
		this.spytext = spytext;
		this.element = element;
		this.element.attr('contentEditable', 'true');
		this.config = typeof config.preset === 'string' ? _.merge(this.presets[config], config) : config;
		this.selectron = new Selectron(element);
		this.timeout = null;

		this.clearTextNodes();
		//var children = element.childNodes.toArray();
		//for(var i in children) {
		//	if(children[i].nodeType !== 3) continue;
		//	if(children[i].textContent.match(/^\s+$/)) {
		//		children[i].vanish();
		//	} else {
		//		console.log('should be wrapping ' + children[i]);
		//		children[i].textContent = children[i].textContent.trim();
		//		children[i].wrap(O('<p></p>'));
		//	}
		//}

		if(!element.firstChild) element.append(O('<p><br /></p>'));
		element.setBR();

		// needs to be loaded after DOM manipulation
		this.snapback = new Snapback(element, { preset: 'spytext', selectron: this.selectron});

		_.each(this.events, function(func, name) {
			element.bind(name, func, that);
		});
	};
	SpytextField.prototype = {
		clearTextNodes: function() {
			var children = this.element.childNodes.toArray();
			for(var i in children) {
				if(children[i].nodeType !== 3) continue;
				if(children[i].textContent.match(/^\s+$/)) {
					children[i].vanish();
				} else {
					children[i].textContent = children[i].textContent.trim();
					children[i].wrap(O('<p></p>'));
				}
			}

			if(!this.element.firstChild) this.element.append(O('<p><br /></p>'));
			this.element.setBR();
		},
		activate: function() {
			this.spytext.setCurrentField(this);
		},
		deactivate: function() {
			this.spytext.unsetCurrentField();
		},
		presets: {
			full: {
				buttons: [ 'bold', 'italic', 'underline', 'strikeThrough', 'removeFormat' ],
				dropdowns: [ 'type ' ]
			},
			format: {
				buttons: [ 'bold', 'italic', 'underline', 'strikeThrough', 'removeFormat' ]
			}
		},
		events: {
			focus: function () {
				this.snapback.enable();
				this.activate();
			},
			blur: function () {
				this.snapback.register();
				this.snapback.disable();
				this.deactivate();
			},
			//mousedown: function(e) {
			//	this.spytext.mousedown = true;
			//},
			keyup: function(e) {
				switch(e.keyCode) {
					case 33:
					case 34:
					case 35:
					case 36:
					case 37:
					case 38:
					case 39:
					case 40:
						this.spytext.setActiveStyles();
						break;
					default:
				}
			},
			keydown: function(e) {
				var that = this;
				function inbetween(a, b) {
					var num = e.keyCode;
					var min = Math.min(a,b);
					var max = Math.max(a,b);
					return num >= min && num <= max;
				}
				if (e.ctrlKey) {
					clearTimeout(this.timeout);
					this.timeout = null;
					this.snapback.register();
					switch(e.keyCode) {
						case 66://b
						case 85://u
							e.preventDefault();
							var arr = [];
							arr[66] = 'bold';
							arr[85] = 'underline';
							this.spytext.execute('format', { command: arr[e.keyCode] }, this.element);
							break;
						case 89://y
							e.preventDefault();
							this.snapback.redo();
							break;
						case 90://z
							e.preventDefault();
							this.snapback.undo();
							break;
						case 65://a
							e.preventDefault();
							this.selectron.select(this.element);
							break;
						case 84://t
							e.preventDefault();
							break;
						case 86://v
							// DO nothing, let paste event be handles
							break;
					}
				} else {
					var rng = this.selectron.range();
					if(inbetween(33,40)) {
						clearTimeout(this.timeout);
						this.timeout = null;
						this.snapback.register();
					} else if(!rng.collapsed && (e.keyCode === 8 || e.keyCode === 46 || e.keyCode === 13 || inbetween(65, 90) || inbetween(48, 57) || inbetween(186, 222) || inbetween(96, 111))) {
						this.snapback.register();
						this.spytext.actions.deleteRangeContents.call(this.spytext, rng);
						if(e.keyCode === 8 || e.keyCode === 46) {
							e.preventDefault();
						}
					} else {
						clearTimeout(this.timeout);
						this.timeout = setTimeout(function() {
							that.timeout = null;
							that.snapback.register();
						}, 300);
					}

					var li, block, positron;
					switch(e.keyCode) {
						case 8:
							// backspace
							rng = this.selectron.range();
							if(rng.collapsed) {
								block = this.element.childNodes.includes(rng.startContainer) ? rng.startContainer : rng.startContainer.closest(this.element.childNodes);
								if(block.matches('UL, OL')) {
									li = rng.startContainer.nodeType === 1 && rng.startContainer.matches('LI') ? rng.startContainer : rng.startContainer.closest('LI');
								}
								positron = this.selectron.get(li || block);
								if(positron.start.offset === 0) {
									e.preventDefault();
									var prev = li && li.previousSibling ? li.previousSibling : block.previousSibling;
									if(prev) {
										this.spytext.actions.join.call(this.spytext, prev.matches('UL, OL') ? prev.lastChild : prev, li ? li : block);
									}
								}
							}
							break;
						case 46:
							// delete
							rng = this.selectron.range();
							if(rng.collapsed) {
								block = this.element.childNodes.includes(rng.startContainer) ? rng.startContainer : rng.startContainer.closest(this.element.childNodes);
								if(block.matches('UL, OL')) {
									li = rng.startContainer.nodeType === 1 && rng.startContainer.matches('LI') ? rng.startContainer : rng.startContainer.closest('LI');
								}
								positron = this.selectron.get(li || block);
								if(positron.start.offset === positron.start.ref.textContent.length) {
									e.preventDefault();
									var next = li && li.nextSibling ? li.nextSibling : block.nextSibling;
									if(next) {
										this.spytext.actions.join.call(this.spytext, li ? li : block, next.matches('UL, OL') ? next.firstChild : next);
									}
								}
							}
							break;
						case 13:
							e.preventDefault();
							this.spytext.actions.newline.call(this.spytext);
							//enter
							break;
					}
				}
			},
			paste: function (e) {
				e.preventDefault();
				var that = this;
				this.snapback.register();
				var rng = this.selectron.range();
				if(!rng.collapsed) {
					this.spytext.actions.deleteRangeContents.call(this.spytext, rng);
				}
				this.spytext.execute('paste', e.clipboardData ? e.clipboardData : clipboardData);
				setTimeout(function() {
					that.snapback.register();
				}, 100);
			}
		}
	};
	return Spytext;
})();
