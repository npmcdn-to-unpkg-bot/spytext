/**
 * All the commands for Spytext
 *
 * @module spytext/commands 
 */

var selectron = require('./selectron'),
	descendants = require('./descendants'),
	blockTags = [ 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI' ];      


/**
 * Uses inline CSS styles to set text-align property for
 * all blocks contained in current selection
 *
 * @static
 * @param	{Element} element - Reference element to be used for selectron to fetch elements contained in selection
 * @return {string} alignment
 */
function align(element, alignment) {
	// get all partlyContained children of element
	var containedChildren = selectron.contained(element, element.children, null, true);

	containedChildren.forEach(function(child) {
		// do not set text-align property on lists
		if(!$(child).is('ul, ol')) $(child).css('text-align', alignment);
	});
}

/**
 * Changes all contained elements with `blockTags` tagName to tag `tag`.
 *
 * @static
 * @param	{Element} element - Reference element to be used for selectron to fetch elements contained in selection
 * @return {string} tag - Tag to turn blocks into. Ie H1 or P
 */
function block(element, tag) {
	var contained = selectron.contained(element, blockTags.join(','), null, true).filter(function(node) {
			// this is to filter out LI with nested lists where only text in the nested
			// list is selected, not text in the actual LI tag siblings to the nested <ul>)
			//
			// this is to fix error that occurs if you have selected LI from nested list, but not any text
			// nodes in the LI containing the nested list. The LI containing 
			return node.nodeName !== 'LI' || $(node).children('UL,OL').length === 0 || selectron.containsSome(_.initial(node.childNodes), true);
		}),
		newBlocks = [],
		$startBlock = $(_.first(contained)),
		$endBlock = $(_.last(contained)),
		startOffset = selectron.offset($startBlock[0], 'start'),
		endOffset = selectron.offset($endBlock[0], 'end'),
		$ref;

	// $ref is the DOM element which we place our new
	// blocks before. if it is undefined, new blocks will
	// be appended to 'element'.
	
	if($endBlock.is('LI')) {
		// if endblock is in a list, we have to do some crazyness
		
		// begin by getting a reference to the ancestor lists
		// NOTE: $startList might not be a list. if $startBlock is not
		// a list, the $startList will be $startBlock (since all block
		// elements except LI are children of 'element'
		var $startList = $startBlock.closest(element.children),
			$endList = $endBlock.closest(element.children);

		if(!$startList.is($endList)) {
			// if $startList and $endList are not the same
			// we place all new blocks before $endList
			$ref = $endList;
		} else if($endBlock[0].nextSibling || $endBlock.children('UL,OL').length > 0) {
			// if endBlock has following siblings or has a nested list,
			// create a new list and place it after startList.
			// place all new blocks before this new list
			$ref = $('<' + $endList[0].tagName + '>').insertAfter($startList).append($endBlock.children('UL,OL').children()).append($endBlock.nextAll());
		} else {
			// $startList is $endList and last selected LI is last child and has no 
			// nested list. simply place all new blocks after $startList/endList, ie
			// before the next element
			$ref = $endList.next();
		}
	} else {
		// $endBlock is not a list, simply place
		// new elements after $endBlocks next sibling
		$ref = $endBlock.next();
	}

	contained.forEach(function(child,i){
		var $newBlock = $('<' + tag + '>');

		// place the newBlock before the reference,
		// or append it to element
		if($ref.length > 0) 
			$ref.before($newBlock);
		else
			$(element).append($newBlock);


		newBlocks.push($newBlock.append(child.childNodes)[0]);

		// remove parent if child has no siblings,
		// otherwise simply remove the child
		if(!child.nextSibling && !child.previousSibling)
			$(child).parent().remove();
		else
			$(child).remove();
	});

	$(':empty:not("BR")', element).remove();
	
	// set the selection
	selectron.set({
		start: {
			ref: _.first(newBlocks),
			offset: startOffset
		},
		end: {
			ref: _.last(newBlocks),
			offset: endOffset
		},
	});
}

/**
 * Removes all empty text nodes adjacent to block level elements
 *
 * @static
 * @param	{Element} element - Element which descendants to look for empty text nodes
 */
function clearTextNodes(element) {
	function isBlock(node) {
		return node && node.nodeType === 1 && !getComputedStyle(node).display.match(/inline/);
	}

	descendants(element, 3).forEach(function(textNode) {
		if(isBlock(textNode.previousSibling) || isBlock(textNode.nextSibling)) {
			// previous or next sibling is a block element

			// trim any whitespaces away from textNode
			textNode.textContent = textNode.textContent.trim();

			if(textNode.textContent.match(/^\s*$/)) {
				// textNode is empty or only contains whitespaces
				$(textNode).remove();
			} else if(textNode.parentNode === element) {
				// if textNode is a child of element, wrap it in <p> tag
				$(textNode).wrap('<p>');
			}
		}
	});

	if(!element.firstChild) {
		// if element is empty, insert <p> element with <BR>
		$(element).append('<p><br /></p>');
	} else {
		// normalize all text nodes in element if not empty
		element.normalize();
	}

	setBR(element);
}

/**
 * Removes all empty text nodes adjacent to block level elements
 *
 * @static
 * @param	{Element} element - Element which descendants to look for empty text nodes
 * @param	{Range} [rng] - 
 */
function deleteRangeContents(element, rng) {
	// fetch range if rng is not set
	rng = rng || selectron.range();

	var $startContainer = $(rng.startContainer),
		$startBlock = $startContainer.closest(blockTags.join(','), element),
		$endBlock = $(rng.endContainer).closest(blockTags.join(','), element),
		startPosition = {
			ref: $startBlock[0],
			offset: selectron.offset($startBlock[0], 'start')
		};

	// use native deleteContents to remove the contents of the selection,
	rng.deleteContents();

	if(!$startBlock.is($endBlock)) {
		// if $startBlock is not $endBlock, we need to clean up any mess that
		// deleteContents has left and then append all childNodes of $endBlock to $startBlock

		if($endBlock.is('LI')) {
			// $endBlock is a list item... we might need to clear up a mess
		
			// $list will be the list to which we move any nested lists of $endBlock
			// to and any of $endBlock's next siblings
			var $list, 
				$nestedList = $endBlock.children('UL,OL');

			if($startBlock.is('LI')) {
				// $startBlock is a listItem,

				// move listItems to $startBlock's parent list)
				$list = $startBlock.parent();

				// append potential $nestedList to $startBlock
				$startBlock.append($nestedList);
			} else {
				// $startBlock is not a listItem which means all $endBlock's previous listItems
				// have been selected. Move listItems to $endBlocks outermost containing list
				$list = $endBlock.closest(element.children);

				// append all $nestedList's children to $list
				$list.append($nestedList.children());
			}

			if(!$list.is($endBlock.parent()) && $endBlock[0].nextSibling) {
				// append all next siblings to $endBlock, but only
				// if $list is not $endBlock's parent (because then target
				// and source will be same)
				$list.append($endBlock.nextAll());
			}
		} 

		// Move all childNodes from $endBlock to $startBlock by inserting them
		// after $startContainer (should now be a at the end of $startBlock).
		// $startContainer is used instead of appending to $startBlock in case a nested list
		// has been appended to $startBlock, otherwise the childNodes would be
		// incorrectly placed after this nested list.
		$startContainer.after($endBlock[0].childNodes);

		// remove the empty $endBlock
		$endBlock.remove();
	}

	setBR($startBlock[0]);

	// rng.deleteContents() will leave empty LI and UL. remove them (recursively)
	$(':empty:not("BR")', element).each(function() {
		var $el = $(this),
			$parent;

		// recurse up the DOM and delete all elements
		// until a non-empty $el is found
		while($el.is(':empty')) {
			$parent = $el.parent();
			$el.remove();
			$el = $parent;
		}
	});

	// restore the selection to the position of the start caret before
	// deleteRangeContents was called
	selectron.set(startPosition);
}

/**
 * Indents all list items (<LI>) contained in the current selection
 *
 * @static
 * @param	{Element} element - Element which descendants to look for empty text nodes
 */
function indent(element){
	var blocks = selectron.contained(element, blockTags.join(','), null, true).filter(function(node) {
			// this filter will ensure all list items with nested lists are only selected if all
			// descendant list items selected or the first list items in their list.
			//
			// this was mainly done to allow indenting ancestor list items if a selected list item is
			// the first item in a nested list
			return node.nodeName !== 'LI' || $(node).children('UL,OL').length === 0 || selectron.containsSome(_.initial(node.childNodes), true) || selectron.containsEvery(descendants(node, function(node) { return node.nodeType === 1 && !node.previousSibling; }, null, true), true);
		}),
		startBlock = _.first(blocks),
		endBlock = _.last(blocks),
		startOffset = selectron.offset(startBlock, 'start'),
		endOffset = selectron.offset(endBlock, 'end');

	blocks.forEach(function(el) {
		// only run the command of 'LI' blocks
		if(!$(el).is('LI')) return;

		var $prev = $(el).prev();

		if($prev.length === 1) {
			// only allow indenting list items if they are not the first items in their list

			// try to fetch the current element's nested list
			var $nestedList = $prev.children('UL,OL');
			if($nestedList.length === 0) {
				// if the previous list item has no nested list, create a new one
				var tagName = $(el).closest('OL,UL')[0].tagName;
				$nestedList = $('<' + tagName + '>').appendTo($(el).prev());
			}
			// append the list item itself to the previous list items nested list.
			// if the list item itself has a nested list, append all list items
			// on this nested list to the previous elements nested list
			$nestedList.append(el).append($(el).children('UL,OL').children());
		}
	});

	// restore the selection
	selectron.set({
		start: {
			ref: startBlock,
			offset: startOffset
		},
		end: {
			ref: endBlock,
			offset: endOffset
		},
	});
}

/**
 * Join `block` with the previous block. Uses a treeWalker to determine
 * what the previous block will be
 *
 * @static
 * @param	{Element} element - Element which is used as root for the TreeWalker
 * @param	{Element} block - Element which should be join the the previous block
 */
function joinPrev(element, block) {
	var treeWalker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT, null, false);
	treeWalker.currentNode = block;

	var prev = treeWalker.previousNode();
	while(prev && blockTags.indexOf(prev.tagName) === -1) { 
		prev = treeWalker.previousNode();
	}

	// prev should only be null or undefined if backspace is called at beginning of field
	if(prev)
		return join(element, prev, block);
}

/**
 * Join `block` with the next block. Uses a treeWalker to determine
 * which the next block is
 *
 * @static
 * @param	{Element} element - Element which is used as root for the TreeWalker
 * @param	{Element} block - Element which should be join the next block
 */
function joinNext(element, block) {
	var treeWalker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT, null, false);
	treeWalker.currentNode = block;

	// delete
	var next = treeWalker.nextNode();
	while(next && blockTags.indexOf(next.tagName) === -1) { 
		next = treeWalker.nextNode();
	}

	// next should only be null or undefined if delete is called at beginning of field
	if(next)
		return join(element, block, next);
}

/**
 * Joins `node1` with `node2`.
 *
 * @static
 * @param	{Element} element - Element which is used as root for the TreeWalker
 * @param	{Element} node1 - First node to join
 * @param	{Element} node2 - Second node to join
 */
function join(element, node1, node2) {
	var length = node1.textContent.length;

	if(node1.firstChild && node1.firstChild.tagName === 'BR') $(node1.firstChild).remove();
	if(node1.lastChild && node1.lastChild.tagName === 'BR') $(node1.lastChild).remove();
	if(node2.lastChild && node2.lastChild.tagName === 'BR') $(node2.lastChild).remove();

	var $nestedList;

	if(($nestedList = $(node1).children('UL,OL')).length === 1) {
		// `node1` has a nested list, and `node2` should
		// be the first list item in the nested list. this means
		// we can leave the nested list, and simply insert
		// `node2` children before the nested list in `node1`.

		// update length to only be length of text in `node1` excluding length of
		// text in nested list, so selectron sets the position correctly
		length = length - $nestedList.text().length;

		$nestedList.before(node2.childNodes);
	} else if(!$(node1).is('LI') && ($nestedList = $(node2).children('UL,OL')).length === 1) {
		// `node1` is a not a list item, and `node2` has nested list. decrease the
		// nested list's level by moving all its children to after `node2`, then
		// remove the nested list.
	
		// insert $nestedList's list items after `node2`
		$(node2).after($nestedList.children());

		// remove the empty $nestedList
		$nestedList.remove();
	}

	// append any childNodes of `node2` to `node1` (this will already be done if `node1` had a nested list
	$(node1).append(node2.childNodes);

	setBR(node1);

	if(!node2.nextSibling && !node2.previousSibling)
		// `node2` has no siblings, so remove parent
		$(node2).parent().remove();
	else
		// `node2` has at least one sibling, only remove `node2`
		$(node2).remove();

	selectron.set({
		ref: node1,
		offset: length
	});
}

/**
 * Formats text by wrapping text nodes in elements with tagName `tag`.
 *
 * @static
 * @param	{Element} element - Element which is used as root for selectron.
 * @param	{string|Element} [tag] - Tag to format text with. If tag is omited, `removeFormat` will be called instead
 */
function format(element, tag){
	if(!tag) return removeFormat(element);

	var position = selectron.get(element),
		containedTextNodes = selectron.contained(element, 3, null, true),
		rng = selectron.range();

	if(rng.startOffset > 0) {
		// range is not at the start of first selected node, we need to split the text node
		node = rng.startContainer;

		// select the innermost textNode
		while(node && node.nodeType !== 3) node = node.firstChild;

		if(node)
			// split the text node. we only want to style the second part of the split textNode,
			// which means we need to replace the reference to node with the new node returned by
			// splitText
			containedTextNodes.splice(0, 1, node.splitText(rng.startOffset));
	}

	if(rng.endOffset < rng.endContainer.textContent.length) {
		// range is not at the end of last selected node, we need to split the text node
		node = rng.endContainer;

		// selected the innermost textNode
		while(node.firstChild && node.nodeType !== 3) node = node.firstChild;

		if(node)
			// simply split the text node.we only want to style the first part of the split textNode,
			// which will still be the node referenced by `node`
			node.splitText(rng.endOffset);
	}

	var $wrapper = _.isString(tag) ? $('<' + tag + '></' + tag + '>') : $(tag).clone();

	$(containedTextNodes).wrap($wrapper);

	// TODO: Tidy, ie <b>Hello <b>Again</b><b>. It continues.</b></b> >> <b>Hello Again. It continues.</b>
	selectron.contained(element, element.children, null, true).forEach(function(contained) {
		contained.normalize();
	});

	// restore the selection
	selectron.set(position);
}

/**
 * Formats text by wrapping text nodes in elements with tagName `tag`.
 *
 * @static
 * @param	{Element} element - Element which is used as root for selectron.
 * @param	{string|Element} [tag] - Tag to format text with. If tag is omited, `removeFormat` will be called instead
 */
function link(element, attribute) {
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
		href = node.attributes.href.value;
		sel.removeAllRanges();
		sel.addRange(range);
	}
	var result = prompt('Link address:', href);

	if (result !== '') {
		document.execCommand('createLink', null, result);
	} else {
		document.execCommand('unlink');
	}
}

/**
 * Turns block elements into list items
 *
 * @static
 * @param	{Element} element - Element which is used as root for selectron.
 * @param	{string} tag - The type of list tag, unordered (<UL>) or ordered (<OL>) lists.
 */
function list(element, tag) {
	var contained = selectron.contained(element, blockTags.join(','), null, true),
		listItems = [];
	
	contained = contained.filter(function(node) {
		// this is to filter out LI with nested lists where only text in the nested
		// list is selected, not text in the actual LI tag siblings to the nested <ul>)
		//
		// this is to fix error that occurs if you have selected LI from nested list, but not any text
		// nodes in the LI containing the nested list. The LI containing 
		return node.nodeName !== 'LI' || $(node).children('UL,OL').length === 0 || selectron.containsSome(_.initial(node.childNodes), true);
	});

	var $startBlock = $(_.first(contained)),
		$endBlock = $(_.last(contained)),
		startOffset = selectron.offset($startBlock[0], 'start'),
		endOffset = selectron.offset($endBlock[0], 'end'),
		$list;

	// $list is a reference to the list all new
	// list items should be appended to. Essentially,
	// after the next block of conditionals
	// we should be able to append all contained blockElements
	// to $list and not have to wrorry about remaining lists
	
	if($startBlock.is('LI')) {
		// $startList and $endList should reference lists furthest up the DOM, ie children of 
		// the fields element
		var $startList = $startBlock.closest(element.children),
			$endList;

		if($endBlock.is('LI'))
			$endList = $endBlock.closest(element.children);

		if($startList.is(tag)) {
			// $startList is already the correct list type
			// simply append all new list items to this
			$list = $startList;

			if($endList && $startList.is($endList)) {
				// we have only selected one list and that list
				// is already the correct list type, so do nothing
				return;
			}
		} else {
			// $startList is the wrong list type, we need to create a new list
			// and insert it after $startList
			$list = $('<' + tag + '>').insertAfter($startList);

			if($endList && $startList.is($endList) && ($endBlock[0].nextSibling || $endBlock.children('UL,OL').length > 0)) {
				// $endBlock is a listItem, $startList is the same as $endList and is
				// the wrong list type AND $endBlock either has following siblings or
				// has a nested list. Thus, we need to create a new list, place it
				// after $list and append siblings and nested lists of $endBlock to it
				//
				// the important part here is that $endBlock has either next siblings or nested lists. if it did not,
				// $endList would be empty at the end of the call to list and thus removed automatically
				$('<' + $endList[0].tagName + '>').insertAfter($list).append($endBlock.children('UL,OL').children()).append($endBlock.nextAll());
			}
		}
	} else {
		// if $startBlock is not a list we need to create a new
		// list that we can append all new list items to.
		// insert this new list before $startBlock
		//
		// if $endBlock is also a list, all blocks inbetween $startBlock
		// and $endBlock will be selected, thus moved into $list and $list
		// will eventually become previousSibling to $endBlock
		$list = $('<' + tag + '>').insertBefore($startBlock);
	}

	contained.forEach(function(child,i){
		var $listItem;

		if(child.tagName === 'LI') {
			// the child is itself a list item, we can simply
			// move it around and do not need a new element
			$listItem = $(child);

			if(!$list.is($listItem.closest(element.children))) {
				// only move the listItem if it is not already
				// contained within the target $list

				// recurse essentially appends the list items to the
				// target $list, but also correctly handles nested lists
				// of the wrong type.
				(function recurse($listItem, $ref) {
					// TODO do not do this if target and soruce list are the same type
					// ie. all nested lists are already the correct list type
					//
					// remove any nested list and save a reference to it
					var $children = $listItem.children("UL,OL").remove();

					// append $listItem to $ref (which will be the target list
					// if we are on first level
					$ref.append($listItem);

					// check if we had found (and removed) any nested lists
					if($children.length > 0) {
						// create a new nested list and append it to the $listItem
						var $nestedList = $('<' + tag + '>').appendTo($listItem);

						// recurse through all of the old nested lists list items
						// and add them to the new nested list
						$children.children().each(function() {
							recurse($(this), $nestedList);
						});
					}
				})($listItem, $list);
			}
		} else {
			// child is not a list item, create a new list item
			// and append all of child's childNodes to it
			$listItem = $('<li>').appendTo($list).append(child.childNodes);

			if(!child.previousSibling && !child.nextSibling)
				// remove child's parent if child is only sibling
				$(child).parent().remove();
			else
				// remove only child if it has no siblings
				$(child).remove();
		}
		// we save a reference to all listItems so we can use
		// them to correctly restore the selection
		listItems.push($listItem[0]);
	});

	// remove empty elements
	$(':empty:not("BR")', element).remove();

	selectron.set({
		start: {
			ref: _.first(listItems),
			offset: startOffset
		},
		end: {
			ref: _.last(listItems),
			offset: endOffset
		},
	});
}

/**
 * Creates a new block (same type as the type of block the caret is currently in.)
 *
 * @static
 * @param	{Element} element - Element which is used as root for selectron.
 * @param	{string|Element} [tag] - Tag to format text with. If tag is omited, `removeFormat` will be called instead
 */
function newline(element) {
	var rng = selectron.range();
	var $blockElement = $(rng.startContainer).closest(blockTags.join(','), element);

	if($blockElement.is('LI') && $blockElement.text().length - $blockElement.children('UL,OL').text().length === 0) {
		// we are in an empty list item (could have a nested list though)
		if($blockElement.parent().is($(element).children())) {
			// list items containing list is child of element... no levels to outdent
			// so create a new 
			block(element, 'P');
		} else {
			// list item of level greater than 1, outdent
			outdent(element);
		}
		return;
	}

	// Select everything from the start of blockElement to the caret. This
	// includes everything that will be moved into the new block placed before the current
	selectron.set({
		start: {
			ref: $blockElement[0],
			offset: 0,
		},
		end: {
			ref: rng.startContainer,
			offset: rng.startOffset
		}
	});
	// extract the contents
	var contents = selectron.range().extractContents();

	// create a new block with the same tag as blockElement, insert it before blockElement and append
	// the contents of the extracted range to it's end
	var $el = $('<' + $blockElement[0].tagName + '>').insertBefore($blockElement).append(contents.childNodes);

	// normalize any textnodes
	$el[0].normalize();

	// ensure correct BR on both affected elements
	setBR([ $el[0], $blockElement[0] ]);

	selectron.set({
		ref: $blockElement[0]
	});
}

/**
 * Outdents all list items contained in the selection one level
 *
 * @static
 * @param	{Element} element - Element which is used as root for selectron.
 */
function outdent(element){
	var blocks = selectron.contained(element, blockTags.join(','), null, true).filter(function(node) {
			// this is to filter out LI with nested lists where only text in the nested
			// list is selected, not text in the actual LI tag siblings to the nested <ul>)
			//
			// this is to fix error that occurs if you have selected LI from nested list, but not any text
			// nodes in the LI containing the nested list. The LI containing 
			return node.nodeName !== 'LI' || $(node).children('UL,OL').length === 0 || selectron.containsSome(_.initial(node.childNodes), true);
		}),
		startOffset = selectron.offset(_.first(blocks), 'start'),
		endOffset = selectron.offset(_.last(blocks), 'end');

	// we outdent in the reverse order from indent
	blocks.reverse().forEach(function(li, i) {
		if(!$(li).is('LI') || $(li).parent().is($(element).children())) {
			// do nothing if not a list item, or if list item
			// is already top level (level 1), ie if it's parent is a child
			// of element
			return;
		} else {
			if(li.nextSibling) {
				// the list item has following siblings, we need
				// to move them into a new or existing nested list

				// attempt to selected a nested list
				var $nestedList = $(li).children('UL,OL');

				if($nestedList.length === 0) {
					// if there is no nested list, create a new one
					var tagName = $(li).closest('OL,UL')[0].tagName;
					$nestedList = $('<' + tagName + '>').appendTo(li);
				}

				// append all list item's next siblings to the nestedlist
				$nestedList.append($(li).nextAll());
			}

			// actual outdenting. Place the list item after its closest LI ancestor
			$(li).parent().parent().after(li);
		}
	});

	selectron.set({
		start: {
			ref: _.last(blocks),
			offset: startOffset
		},
		end: {
			ref: _.first(blocks),
			offset: endOffset
		},
	});
}

/**
 * Pastes the data of the dataTransfer. Deletes range contents if selection is
 * not collapsed
 *
 * @static
 * @param	{Element} element - Element which is used as root for selectron.
 * @param	{DataTransfer} dataTransfer - Must have a getData method which returns pure text string
 */
function paste(element, dataTransfer) {
	var rng = selectron.range(),
		textBlocks = dataTransfer.getData('Text').replace(/</g, '&lt;').replace(/>/, '&gt;').replace(/[\n\r]+$/g, '').split(/[\n\r]+/);

	if(!rng.collapsed) {
		// delete range contents if not collapsed
		deleteRangeContents(element, rng);
		rng = selectron.range();
	}

	if(textBlocks.length > 0) {
		var blockElement = $(rng.startContainer).closest(blockTags.join(','), element)[0];

		// Select everything from the caret to the end of blockElement and
		// extract the contents. this is so we can to append the first text block
		// to the current block, and insert the extracted contents after the
		// last text block. if we are only pasting one text block, we could
		// have simply split the current node and inserted the contents inbetween
		selectron.set({
			start: { ref: rng.startContainer, offset: rng.startOffset },
			end: { ref: blockElement, offset: blockElement.textContent.length }
		});
		var contents = selectron.range().extractContents();

		
		var ref = blockElement.nextSibling,// will be used to place new blocks into the DOM
			parent = blockElement.parentNode,// if no next sibling, save reference to parent
			textNode,
			$el;

		for(var i = 0; i < textBlocks.length; i++) {
			textNode = document.createTextNode(textBlocks[i]);
			if(i === 0) {
				if(blockElement.lastChild.nodeName === 'BR')
					// remove the last item if it is a line break
					$(blockElement.lastChild).remove();

				// since this is the first text Block,
				// simply append the textNode to the blockElement
				$(blockElement).append(textNode);
			} else {
				// create a new block 
				$el = $('<' + blockElement.tagName + '>').append(textNode);

				if(ref)
					// insert before the ref
					$(ref).before($el);
				else
					// append to parent if we have no ref
					$(parent).append($el);
			}
		}
		// append any contents extracted from the range prevously to the
		// last inserted new block, or blockElement if only
		// one text block was pasted
		($el || $(blockElement)).append(contents.childNodes);

		// set the range to end of last inserted textnode
		selectron.set({
			ref: textNode,
			offset: textNode.textContent.length,
		});
	}
}


/**
 * Removes inline formatting of selection
 *
 * @static
 * @param	{Element} element - Only used to normalize text nodes
 */
function removeFormat(element) {
	document.execCommand('removeFormat');
	element.normalize();
}

/**
 * Ensures empty block text
 *
 * @static
 * @param	{Element} element - Only used to normalize text nodes
 */
function setBR(element) {
	if(_.isArray(element)) 
		return element.forEach(setBR);
	
	if(element.firstChild && element.firstChild.tagName !== 'BR' && element.textContent.length === 0)
		$(element).empty();

	if(!element.firstChild || $(element.firstChild).is('UL,OL'))
		$(element).prepend('<BR>');
	else {
		_.toArray(element.getElementsByTagName('BR')).forEach(function(br) {
			if(br.previousSibling && !br.nextSibling)
				$(br).remove();
		});
	}
}

module.exports = {
	align: align,
	block: block,
	clearTextNodes: clearTextNodes,
	deleteRangeContents: deleteRangeContents,
	format: format,
	indent: indent,
	join: join,
	joinPrev: joinPrev,
	joinNext: joinNext,
	link: link,
	list: list,
	newline: newline,
	outdent: outdent,
	paste: paste,
	removeFormat: removeFormat,
	setBR: setBR
};
