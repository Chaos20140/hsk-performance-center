/* impressum.html — extracted from the Claude Design source. Generated; do not edit. */
(function () {
  "use strict";
  class DCLogic { constructor(p) { this.props = p || {}; this.state = {}; } setState(x) { Object.assign(this.state, x); } }

    
  class Component extends DCLogic {  
    componentDidMount() {  
      this.apply();  
      this._onResize = () => this.apply();  
      window.addEventListener('resize', this._onResize);  
    }  
    
    componentDidUpdate() { this.apply(); }  
    
    componentWillUnmount() { window.removeEventListener('resize', this._onResize); }  
    
    // label/value rows stack below the point where the label column gets too narrow to read  
    apply() {  
      const narrow = window.innerWidth < 660;  
      document.querySelectorAll('[data-row]').forEach((el) => {  
        el.style.gridTemplateColumns = narrow ? 'minmax(0,1fr)' : 'minmax(0,.34fr) minmax(0,.66fr)';  
        el.style.gap = narrow ? '5px' : 'clamp(12px,2vw,28px)';  
      });  
      const note = document.querySelector('[data-note]');  
      if (note) note.style.flexDirection = narrow ? 'column' : 'row';  
    }  
  }  
  

  var app = new Component({});
  function boot() { if (app.componentDidMount) app.componentDidMount(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
