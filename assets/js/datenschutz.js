/* datenschutz.html — extracted from the Claude Design source. Generated; do not edit. */
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
  
    apply() {
      const w = window.innerWidth;
      const narrow = w < 660;
      document.querySelectorAll('[data-row]').forEach((el) => {
        el.style.gridTemplateColumns = narrow ? 'minmax(0,1fr)' : (el.dataset.cols || 'minmax(0,.3fr) minmax(0,.7fr)');
        el.style.gap = narrow ? '5px' : 'clamp(12px,2vw,28px)';
      });
      // two-column lists collapse before the labels start wrapping mid-phrase
      const single = w < 720 ? 'minmax(0,1fr)' : 'repeat(2,minmax(0,1fr))';
      const toc = document.querySelector('[data-toc]');
      if (toc) toc.style.gridTemplateColumns = single;
      const rights = document.querySelector('[data-rights]');
      if (rights) rights.style.gridTemplateColumns = single;
      const note = document.querySelector('[data-note]');
      if (note) note.style.flexDirection = narrow ? 'column' : 'row';
    }
  }
  

  var app = new Component({});
  function boot() { if (app.componentDidMount) app.componentDidMount(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
