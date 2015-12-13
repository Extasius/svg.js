SVG.easing = {
  '-': function(pos){return pos}
, '<>':function(pos){return -Math.cos(pos * Math.PI) / 2 + 0.5}
, '>': function(pos){return  Math.sin(pos * Math.PI / 2)}
, '<': function(pos){return -Math.cos(pos * Math.PI / 2) + 1}
}

SVG.Situation = SVG.invent({

  create: function(o) {

    if(o instanceof SVG.Situation) return o

    o = o || {}

    this._duration = o.duration || 1000
    this._delay = o.delay || 0
    this._start = +new Date + this._delay
    this._end = this._start + this._duration

    this.easing = SVG.easing[o.easing || '-'] || o.easing // when easing is a function, its not in SVG.easing
    this.pos = 0        // position before easing
    this.lastPos = 0    // needed for once callbacks
    this.paused = false
    this.finished = false
    this.active = false
    this._fx = null

    this.animations = {
      // functionToCall: [morphable object, destination value]
      // e.g. x: [SVG.Number, 5]
      // this way its assured, that the start value is set correctly
    }
    
    this._once = {
      // functions to fire at a specific position
      // e.g. "0.5": function foo(){}
    }

  }

, extend: {

    // returns the position at a given time
    timeToPos: function(timestamp){
      return (timestamp - this._start) / (this._duration)
    }

    // returns the timestamp from a given positon
  , posToTime: function(pos){
      return this._duration * pos + this._start
    }

  , startAnimFrame: function(){
      this.animationFrame = requestAnimationFrame(function(){ this.step() }.bind(this))
    }

  , stopAnimFrame: function(){
      cancelAnimationFrame(this.animationFrame)
    }

  , start: function(){

      if(this.fx().current() == this){
        // morph values from the current position to the destination - maybe move this to another place
        for(var i in this.animations){
          if(this.animations[i] instanceof Array){
            
            this.animations[i] = new this.animations[i][0](this.fx().target[i]()).morph(this.animations[i][1])
            console.log(i, this.animations[i])
          }
        }
      }
      
      // dont start if already started
      if(!this.active && this.fx().current() == this){
        this._start = +new Date + this._delay
        this._end = this._start + this._duration
        this.active = true

        this.timeout = setTimeout(function(){ this.startAnimFrame() }.bind(this), this.delay)
      }

      return this
    }

  , stop: function(){
      if(!this.active) return false
      this.active = false
      this.stopAnimFrame()
      clearTimeout(this.timeout)

      return this
    }

  , seek: function(pos){
      this.pos = pos
      this._start = -pos * this.duration + new Date
      this._end = this._start + this._duration
      return this
    }

  , speed: function(speed){
      this.speed = speed
      this.duration = this.duration * this.pos + (1-this.pos) * this.duration / speed
      this._end = this._start + this._duration
      return this
    }

  , pause: function(){
      this.paused = true
      this.stopAnimFrame()
      clearTimeout(this.timeout)
      return this
    }

  , play: function(){
      if(this.paused){
        this.seek(this.pos)
        this.paused = false
        this.startAnimFrame()
      }

      return this
    }

  , push: function(method, args){
      this.animations[method] = args
      return this
    }

  , pop: function(method){
      var ret = this.animations[method]
      this.drop(method)
      return ret
    }

  , drop: function(method){
      delete this.animations[method]
      return this
    }

  , get: function(method){
      return this.animations[method]
    }

  , getAt: function(method){
      return this.get(method).at(this.easing(this.pos))
    }

  , step: function(){

      if(this.paused) return this

      this.pos = this.timeToPos(+new Date)

      if(this.pos > 1) this.pos = 1
      if(this.pos < 0) this.pos = 0

      var eased = this.easing(this.pos)
      
      for(var i in this._once){
        if(i > this.lastPos && i < eased) this._once[i](this.pos, eased)
      }
      
      this.fx().target.fire('during', {pos: this.pos, eased: eased})
      
      this.eachAt(function(method, args){
        this.fx().target[method].apply(this.fx().target, args)
      })

      if(this.pos == 1){
        this.finished = true
        this.active = false
        this.fx().target.fire('situationfinished')
        this.fx().startNext()
        //var next = this.fx().next()
        //if(next)next.start()
        cancelAnimationFrame(this.animationFrame)
      }else{
        this.startAnimFrame()
      }

      this.lastPos = eased
      return this

    }

  , eachAt: function(block){

      for(var i in this.animations){

        var at = [].concat(this.animations[i]).map(function(el){
          if(el.at) return el.at(this.easing(this.pos))
          return el
        }.bind(this))
        
        block.call(this, i, at)

      }

    }

  , fx: function(fx){
      if(fx){
        this._fx = fx
        return this
      }

      return this._fx
    }
  
  
  , once: function(pos, fn, isEased){

      if(!isEased)pos = this.easing(pos)

      this._once[pos] = fn

      return this
    }
    
  }

})

SVG.FX = SVG.invent({
  // Initialize FX object
  create: function(element) {
    // store target element
    this.target = element
    this._queue = []
    this._current = 0
  }

  // Add class methods
, extend: {

    // pushs a new situation to the queue
    enqueue: function(o) {
      this.queue().push(new SVG.Situation(o).fx(this))
      return this
    }

    // returns the queue
  , queue: function() {
      return this._queue;
    }

  , current: function() {
      return this.get(this._current)
    }

  , last: function() {
      return this.get(this.queue().length-1)
    }
    
  , first: function() {
      return this.get(0)
    }
    
  , search: function(attr) {
      var current = this.queue().length-1
  
      while(situation = this.get(--current)){
      
        // get method of situation if present
        var attr = situation.get(attr)
        if(!attr) continue
        
        // if not yet morphed we extract the destination from the array
        //if(attr instanceof Array) return attr[1]
        
        // otherwise from the morphed object
        return attr.destination

      }

      // return the elements attribute as fallback
      return this.target[attr]()

    }

  , prev: function() {
      return this.get(--this._current)
    }

  , next: function() {
      return this.get(++this._current)
    }

  , get: function(i) {
      if(!this._queue[i]) return null
      return this._queue[i]
    }
    
  , startNext: function() {
      
      var next = this.next()
      if(next) next.start()
      else this.finish()
      
      return this
    }

  , pause: function() {
      this.current().pause()
      return this
    }

  , play: function() {
      this.current().play()
      return this
    }

    /*
  , resume: function() {
      this.active = true
    }*/

  , finish: function() {
      this.active = false
      this.target.fire('fxfinished')
      return this
    }

  , reverse: function() {
      this.reverse = true
      this.current().play()
      return this
    }

  , progress: function(pos) {
      this.get(this._current).progress(pos)
      return this
    }

  , totalProgress: function(pos) {
      if(pos == null) return this.total
      this.total = pos
      return this
    }

  , time: function(d) {
      return this.progress(this.duration / d)
    }

  , totalTime: function(d) {
      return this.totalProgress(this.duration / d)
    }

  , timeScale: function(factor) {
      this.scale = factor
      return this
    }

    // Animatable x-axis
  , x: function(x) {
      //this.last().push('x', [SVG.Number, x]).start()
      this.last().push('x', new SVG.Number(this.search('x')).morph(x)).start()
      return this
    }
    // Animatable y-axis
  , y: function(y) {
      //this.last().push('y', [SVG.Number, y]).start()
      this.last().push('y', new SVG.Number(this.search('y')).morph(y)).start()

      return this
    }
    // Animatable center x-axis
  , cx: function(x) {
      //this.last().push('cx', [SVG.Number, x]).start()
      this.last().push('cx', new SVG.Number(this.search('cx')).morph(x)).start()

      return this
    }
    // Animatable center y-axis
  , cy: function(y) {
      //this.last().push('cy', [SVG.Number, y]).start()
      this.last().push('cy', new SVG.Number(this.search('cy')).morph(y)).start()

      return this
    }
    // Add animatable move
  , move: function(x, y) {
      return this.x(x).y(y)
    }
    // Add animatable center
  , center: function(x, y) {
      return this.cx(x).cy(y)
    }
  , dx: function(x) {
      return this.x(this.search('x') + x)
    }
  , dy: function(y) {
      return this.y(this.search('y') + y)
    }
  // Relative move over x and y axes
  , dmove: function(x, y) {
      return this.dx(x).dy(y)
    }
  /*, attr: function(a, v) {
      // apply attributes individually
      if (typeof a == 'object') {
        for (var key in a)
          this.attr(key, a[key])
      
      } else {
        // get the current state
        //var from = this.target.attr(a)

        // detect format
        if (a == 'transform') {
          // merge given transformation with an existing one
          if (this.attrs[a])
            v = this.attrs[a].destination.multiply(v)

          // prepare matrix for morphing
          this.attrs[a] = (new SVG.Matrix(this.target)).morph(v)

          // add parametric rotation values
          if (this.param) {
            // get initial rotation
            v = this.target.transform('rotation')

            // add param
            this.attrs[a].param = {
              from: this.target.param || { rotation: v, cx: this.param.cx, cy: this.param.cy }
            , to:   this.param
            }
          }

        } else {
          this.attrs[a] = SVG.Color.isColor(v) ?
            // prepare color for morphing
            new SVG.Color(from).morph(v) :
          SVG.regex.unit.test(v) ?
            // prepare number for morphing
            new SVG.Number(from).morph(v) :
            // prepare for plain morphing
            { from: from, to: v }
        }
      }
      
      return this
    }*/

  }

  // Define parent class
, parent: SVG.Element

  // Add method to parent elements
, construct: {
    // Get fx module or create a new one, then animate with given duration and ease
    animate: function(o) {
      return (this.fx || (this.fx = new SVG.FX(this))).enqueue(o)
    }
  , delay: function(delay){
      return (this.fx || (this.fx = new SVG.FX(this))).enqueue({delay:delay})
    }
  }
})