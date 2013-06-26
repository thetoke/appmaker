var Design = new Tool('Design')
Design.color = 'rgba(26, 134, 214, 1)'
Design.description = 'Design pages in NudgePad.'

// What spot the maker is on the timeline for the current page
Design.page = new Page()
Design.edge = new Space()
Design.stage = {}
Design.stage.activePage = 'home'
// store.get('activePage')
Design.stage.selection = {}

Design.blank = function () {

  var page = new Space(
'head\n\
 tag head\n\
 scraps\n\
  title\n\
   tag title\n\
   content Untitled\n\
  stylesheet\n\
   tag link\n\
   href project.css\n\
   rel stylesheet\n\
body\n\
 tag body\n\
 scraps\n')
  var pageName = prompt('Name your page', Design.nextName())
  if (!pageName)
    return null
  Design.create(pageName, page)
  
}

/**
 *
 */
Design.clearTimeline = function () {
  
  if (!confirm("Are you sure you want to erase the history of this page?"))
    return false
  
  
  
  // Send Commit to Server
  Project.delete('timelines ' + Design.stage.activePage)
  var timestamp = new Date().getTime()
  Project.set('timelines ' + Design.stage.activePage + ' ' + timestamp, Design.edge.toString())
  // collapse at edge
  Design.stage.timeline = Project.get('timelines ' + Design.stage.activePage)

  Design.stage.version = Design.stage.timeline.length()
  Design.trigger('selection')
  return true
}

/**
 * Creates a new page. todo: rename page param to edge
 *
 * @param {string} Name of the file
 * @param {Space} A first patch to initialize the page with.
 * @return {string} The name of the created page
 */
Design.create = function (name, template) {
  
  name = (name ? Permalink(name) : Design.nextName())
  
  // page already exists
  if (Project.get('pages ' + name))
    return Flasher.error('A page named ' + name + ' already exists.')
  
  var page = new Space()
  var timeline = new Space()
  if (template && template.toString().length > 2) {
    page = new Space(template.toString())
    var commit = new Space()
    commit.set('author', Cookie.email)
    commit.set('values', new Space(template.toString()))
    timeline.set(new Date().getTime(), commit)
  }
  
  Project.set('pages ' + name, page)
  Project.set('timelines ' + name, timeline)
  
  Design.stage.open(name)
  mixpanel.track("I created a new webpage")
  return name
}

/**
 * Duplicates the current open page.
 *
 * @param {string} name of page to duplicate. Defaults to current page.
 * @param {string} name of new page. Defaults to source + 1
 * @param {bool} We need to skip prompting for unit testing.
 * @return {string} Name of new page
 */
Design.duplicate = function (source, destination, skipPrompt) {
  
  source = source || Design.stage.activePage
  
  destination = Design.nextName(destination || source)
  
  if (!skipPrompt) {
    destination = prompt('Name your new page', destination)
    if (!destination)
      return false
  }
  
  if (!Project.get('pages').get(source))
    return Flasher.error('Page ' + source + ' not found')
  
  mixpanel.track('I duplicated a page')
  
  // If we are duplicating a page thats not open, easy peasy
  if (source !== Design.stage.activePage)
    return Design.create(destination, Project.get('pages').get(source))
  
  return Design.create(destination, Design.page)
}

Design.getPageDimensions = function (page) {
  page = new Page(page)
  page._static = true
  var iframe = $('<iframe class="deleteMe" style="position: fixed; right: 0px; top: 0px;"></iframe>')
  iframe.attr('frameborder', 0)
  iframe.attr('scrolling', 'no')
  iframe.css('width', 1)
  iframe.css('height', 1)
  $('#Temp').append(iframe)
  iframe.contents().find('body').append(page.toHtml())
  var box = {}
  var first = false
  iframe.contents().find('.scrap').each(function () {
    var left
    var right
    var _top
    var bottom
    if (!first) {
      box.left = $(this).position().left
      box.right = box.left + $(this).outerWidth()
      box.top = $(this).position().top
      box.bottom = box.top + $(this).outerHeight()
      first = true
    }
    else {
      left = $(this).position().left
      right = left + $(this).outerWidth()
      _top = $(this).position().top
      bottom = top + $(this).outerHeight()
      if (left < box.left)
        box.left = left
      if (right > box.right)
        box.right = right
      if (_top < box.top)
        box.top = _top
      if (bottom > box.bottom)
        box.bottom = bottom
    }
  })
  box.height = box.bottom - box.top
  box.width = box.right - box.left
  $('.deleteMe').remove()
  return box
}

Design.import = function (url) {
  $.get('/nudgepad.import/' + url, {}, function (data) {
    Design.page = new Page(data)
    Design.stage.commit()
    Design.stage.open(Design.stage.activePage)
  })
}

Design.importPrompt = function () {
  
  var url = prompt('Enter a url to import')
  if (!url)
    return false
  
  if (!url.match(/^https?\:\/\//))
    url = 'http://' + url
  Design.import(url)
  
}

/**
 * Get the next available name. For example untitled_1 or untitled_2
 *
 * @param {string} Optional prefix to add to the name. Defaults to untitled_
 * @return {string} The new name
 */
Design.nextName = function (prefix) {
  var prefix = prefix || 'untitled'
  if (!(prefix in Project.values.pages.values))
    return prefix
  for (var i = 1; i < 1000; i++) {
    if (!(prefix + i in Project.values.pages.values))
      return prefix + i
  }
}

/**
 */
Design.oncut = function(e) {
  
  // Return true if maker is editing an input
  if ($('input:focus, div:focus, textarea:focus, a:focus').length)
    return true
  
  if (!Design.stage.selection.exists())
    return true
    
  if (e.clipboardData) {
    e.preventDefault()
    e.clipboardData.setData(
        'text/xcustom', Design.stage.selection.toSpace().toString())

    var setStatus = e.clipboardData.setData(
        'text/plain', Design.stage.selection.toSpace().toString())
    console.log('setData: ' + setStatus)
  }
  if (window.clipboardData) {
    e.returnValue = false
    var setStatus = window.clipboardData.setData(
      'Text', Design.stage.selection.toSpace().toString())
    console.log('setData: ' + setStatus)
  }
  Design.stage.selection.remove()
  Design.stage.commit()
  mixpanel.track('I cut something')
}

/**
 * Allows you to drag and drop files from finder onto the page.
 * Only supports 1 file at a time for now. And chrome. Very limited.
 */
Design.ondrop = function(e) {
  mixpanel.track('I dropped a file onto the page')
  var reader = new FileReader()
  reader.onload = function(evt) {
    var space = new Space(
      "tag img\n" +
      "src " + evt.target.result +
      "\nstyle" +
      "\n width auto" +
      "\n height auto")
    var scraps = new Space().set('scrap1', space)
    Design.stage.insert(scraps)
  }
  reader.readAsDataURL(e.dataTransfer.files[0])
  e.preventDefault()
}

Design.stopPropagation = function(event) {
  if (event.originalEvent.touches.length > 1) {
    event.stopPropagation()
  }
}

Design.preventDefault = function(event) {
  if (event.originalEvent.touches.length == 1) {
    event.preventDefault()
  }
}

/**
 * Start editing text when maker enters a character key.
 *
 * @param {object} keydown event.
 * @return {bool} Allow propagation unless we start editing.
 */
Design.onkeydown = function (event) {
  // if maker is typing in a div or input already dont do anything
  if ($('input:focus, div:focus, textarea:focus, a:focus').length != 0)
    return true
  // allow control key combos to pass through
  if (event.ctrlKey || event.metaKey || event.shiftKey)
    return true
  // if a f key or something dont return.
  if ((event.keyCode < 48 && event.keyCode != 32) || event.keyCode > 90)
    return true
  // if no subject return
  if (!$('.selection').length)
    return true
  // if an input or something return true
  if ($('.selection').is("input") || $('.selection').is("textarea"))
    return true
  // trigger edit event on the scrap
  $('.selection').scrap().edit()
}

Design.onresize = function () {
  // Update all handles on resize
  $('.handle').trigger('update')
}

/**
 * Renames the currently open page.
 *
 * @param {string} New name
 * @return {string} todo: why return a string?
 */
Design.rename = function (new_name) {
  
  mixpanel.track('I renamed a page')
  
  new_name = Permalink(new_name)
  var old_name = Design.stage.activePage
  
  if (!new_name.length)
    return Flasher.error('Name cannot be blank')
  
  if (old_name == 'home')
    return Flasher.error('You cannot rename the home page.')
  
  // page already exists
  if (Project.get('pages ' + new_name))
    return Flasher.error('A page named ' + new_name + ' already exists.')  

  Project.set('pages ' + new_name, Project.get('pages ' + old_name))
  Project.set('timelines ' + new_name, Project.get('timelines ' + old_name))
  Project.delete('pages ' + old_name)
  Project.delete('timelines ' + old_name)
  
  Design.updateTabs()
  
  Design.stage.open(new_name)
  
  mixpanel.track('I renamed a page')
  
  return ''

}

Design.renamePrompt = function () {
  var name = prompt('Enter a new name', Design.stage.activePage)
  if (name)
    Design.rename(name)
}

/**
 * Launches the spotlight page picker
 */
Design.spotlight = function () {
  
  var name = prompt('Enter the name of the page to open...', '')
  if (name)
    Design.stage.open(name)
}


/**
 * Deletes a page.
 *
 * @param {string} Name of the file
 * @return {string} todo: why return a string?
 */
Design.trash = function (name) {
  name = name || Design.stage.activePage
  if (name === 'home')
    return Flasher.error('You cannot delete the home page')
  // If its the currently open page, open the previous page first
  if (Design.stage.activePage === name)
    Design.stage.back()

  Project.delete('pages ' + name)
  Project.delete('timelines ' + name)
  
  // Delete page from open pages
  Design.updateTabs()
  Flasher.success('Deleted ' + name, 1000)
  mixpanel.track('I deleted a page')
  return ''
}

