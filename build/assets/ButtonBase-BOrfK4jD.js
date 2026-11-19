import{a as e,n as t}from"./rolldown-runtime-B0Z9INg1.js";import{$t as n,An as r,At as i,H as a,J as o,K as s,Lt as c,Mn as l,Nt as u,Ot as d,St as f,Tt as p,U as m,V as h,Yt as g,Zt as _,d as v,f as y,jt as b,k as ee,kn as x,kt as S,nt as C,p as te,q as w,tt as T}from"./MDTypography-Ie5fCSBB.js";r(),i();function E(e,t){return E=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(e,t){return e.__proto__=t,e},E(e,t)}function ne(e,t){e.prototype=Object.create(t.prototype),e.prototype.constructor=e,E(e,t)}var D=e(l()),O=D.createContext(null);function re(e){if(e===void 0)throw ReferenceError(`this hasn't been initialised - super() hasn't been called`);return e}function k(e,t){var n=function(e){return t&&(0,D.isValidElement)(e)?t(e):e},r=Object.create(null);return e&&D.Children.map(e,function(e){return e}).forEach(function(e){r[e.key]=n(e)}),r}function ie(e,t){e||={},t||={};function n(n){return n in t?t[n]:e[n]}var r=Object.create(null),i=[];for(var a in e)a in t?i.length&&(r[a]=i,i=[]):i.push(a);var o,s={};for(var c in t){if(r[c])for(o=0;o<r[c].length;o++){var l=r[c][o];s[r[c][o]]=n(l)}s[c]=n(c)}for(o=0;o<i.length;o++)s[i[o]]=n(i[o]);return s}function A(e,t,n){return n[t]==null?e.props[t]:n[t]}function j(e,t){return k(e.children,function(n){return(0,D.cloneElement)(n,{onExited:t.bind(null,n),in:!0,appear:A(n,`appear`,e),enter:A(n,`enter`,e),exit:A(n,`exit`,e)})})}function M(e,t,n){var r=k(e.children),i=ie(t,r);return Object.keys(i).forEach(function(a){var o=i[a];if((0,D.isValidElement)(o)){var s=a in t,c=a in r,l=t[a],u=(0,D.isValidElement)(l)&&!l.props.in;c&&(!s||u)?i[a]=(0,D.cloneElement)(o,{onExited:n.bind(null,o),in:!0,exit:A(o,`exit`,e),enter:A(o,`enter`,e)}):!c&&s&&!u?i[a]=(0,D.cloneElement)(o,{in:!1}):c&&s&&(0,D.isValidElement)(l)&&(i[a]=(0,D.cloneElement)(o,{onExited:n.bind(null,o),in:l.props.in,exit:A(o,`exit`,e),enter:A(o,`enter`,e)}))}}),i}var N=Object.values||function(e){return Object.keys(e).map(function(t){return e[t]})},ae={component:`div`,childFactory:function(e){return e}},P=function(e){ne(t,e);function t(t,n){var r=e.call(this,t,n)||this;return r.state={contextValue:{isMounting:!0},handleExited:r.handleExited.bind(re(r)),firstRender:!0},r}var n=t.prototype;return n.componentDidMount=function(){this.mounted=!0,this.setState({contextValue:{isMounting:!1}})},n.componentWillUnmount=function(){this.mounted=!1},t.getDerivedStateFromProps=function(e,t){var n=t.children,r=t.handleExited;return{children:t.firstRender?j(e,r):M(e,n,r),firstRender:!1}},n.handleExited=function(e,t){var n=k(this.props.children);e.key in n||(e.props.onExited&&e.props.onExited(t),this.mounted&&this.setState(function(t){var n=x({},t.children);return delete n[e.key],{children:n}}))},n.render=function(){var e=this.props,t=e.component,n=e.childFactory,r=S(e,[`component`,`childFactory`]),i=this.state.contextValue,a=N(this.state.children).map(n);return delete r.appear,delete r.enter,delete r.exit,t===null?D.createElement(O.Provider,{value:i},a):D.createElement(O.Provider,{value:i},D.createElement(t,r,a))},t}(D.Component);P.propTypes={},P.defaultProps=ae;var F,I=t((()=>{d(),F=_}));function oe(e){return u(`MuiSvgIcon`,e)}var L=t((()=>{d(),T(),b(`MuiSvgIcon`,[`root`,`colorPrimary`,`colorSecondary`,`colorAction`,`colorError`,`colorDisabled`,`fontSizeInherit`,`fontSizeSmall`,`fontSizeMedium`,`fontSizeLarge`])})),R,z,B,V,H,U,W,se=t((()=>{r(),i(),R=e(l()),a(),te(),y(),w(),m(),L(),z=f(),B=f(),V=[`children`,`className`,`color`,`component`,`fontSize`,`htmlColor`,`inheritViewBox`,`titleAccess`,`viewBox`],H=e=>{let{color:t,fontSize:n,classes:r}=e,i={root:[`root`,t!==`inherit`&&`color${v(t)}`,`fontSize${v(n)}`]};return c(i,oe,r)},U=s(`svg`,{name:`MuiSvgIcon`,slot:`Root`,overridesResolver:(e,t)=>{let{ownerState:n}=e;return[t.root,n.color!==`inherit`&&t[`color${v(n.color)}`],t[`fontSize${v(n.fontSize)}`]]}})(({theme:e,ownerState:t})=>{var n,r,i,a;return{userSelect:`none`,width:`1em`,height:`1em`,display:`inline-block`,fill:`currentColor`,flexShrink:0,transition:(n=e.transitions)?.create?.call(n,`fill`,{duration:e.transitions?.duration?.shorter}),fontSize:{inherit:`inherit`,small:(r=e.typography)?.pxToRem?.call(r,20)||`1.25rem`,medium:(i=e.typography)?.pxToRem?.call(i,24)||`1.5rem`,large:(a=e.typography)?.pxToRem?.call(a,35)||`2.1875rem`}[t.fontSize],color:(e.vars||e).palette?.[t.color]?.main??{action:(e.vars||e).palette?.action?.active,disabled:(e.vars||e).palette?.action?.disabled,inherit:void 0}[t.color]}}),W=R.forwardRef(function(e,t){let n=o({props:e,name:`MuiSvgIcon`}),{children:r,className:i,color:a=`inherit`,component:s=`svg`,fontSize:c=`medium`,htmlColor:l,inheritViewBox:u=!1,titleAccess:d,viewBox:f=`0 0 24 24`}=n,p=S(n,V),m=x({},n,{color:a,component:s,fontSize:c,instanceFontSize:e.fontSize,inheritViewBox:u,viewBox:f}),g={};u||(g.viewBox=f);let _=H(m);return(0,B.jsxs)(U,x({as:s,className:h(_.root,i),focusable:`false`,color:l,"aria-hidden":!d||void 0,role:d?`img`:void 0,ref:t},g,p,{ownerState:m,children:[r,d?(0,z.jsx)(`title`,{children:d}):null]}))}),W.muiName=`SvgIcon`})),ce=t((()=>{se(),L(),L()}));function le(e,t){function n(n,r){return(0,ue.jsx)(W,x({"data-testid":`${t}Icon`,ref:r},n,{children:e}))}return n.muiName=W.muiName,G.memo(G.forwardRef(n))}var G,ue,de=t((()=>{r(),G=e(l()),ce(),ue=f()})),K,fe=t((()=>{d(),K=n})),pe,me=t((()=>{d(),pe=g}));C(),I(),ee(),fe(),me(),a();var q=f();function he(e){let{className:t,classes:n,pulsate:r=!1,rippleX:i,rippleY:a,rippleSize:o,in:s,onExited:c,timeout:l}=e,[u,d]=D.useState(!1),f=h(t,n.ripple,n.rippleVisible,r&&n.ripplePulsate),p={width:o,height:o,top:-(o/2)+a,left:-(o/2)+i},m=h(n.child,u&&n.childLeaving,r&&n.childPulsate);return!s&&!u&&d(!0),D.useEffect(()=>{if(!s&&c!=null){let e=setTimeout(c,l);return()=>{clearTimeout(e)}}},[c,s,l]),(0,q.jsx)(`span`,{className:f,style:p,children:(0,q.jsx)(`span`,{className:m})})}d();var J=b(`MuiTouchRipple`,[`root`,`ripple`,`rippleVisible`,`ripplePulsate`,`child`,`childLeaving`,`childPulsate`]);r(),i(),a(),m(),w();var Y=[`center`,`classes`,`className`],X=e=>e,ge,Z,Q,_e,$=550,ve=p(ge||=X`
  0% {
    transform: scale(0);
    opacity: 0.1;
  }

  100% {
    transform: scale(1);
    opacity: 0.3;
  }
`),ye=p(Z||=X`
  0% {
    opacity: 1;
  }

  100% {
    opacity: 0;
  }
`),be=p(Q||=X`
  0% {
    transform: scale(1);
  }

  50% {
    transform: scale(0.92);
  }

  100% {
    transform: scale(1);
  }
`),xe=s(`span`,{name:`MuiTouchRipple`,slot:`Root`})({overflow:`hidden`,pointerEvents:`none`,position:`absolute`,zIndex:0,top:0,right:0,bottom:0,left:0,borderRadius:`inherit`}),Se=s(he,{name:`MuiTouchRipple`,slot:`Ripple`})(_e||=X`
  opacity: 0;
  position: absolute;

  &.${0} {
    opacity: 0.3;
    transform: scale(1);
    animation-name: ${0};
    animation-duration: ${0}ms;
    animation-timing-function: ${0};
  }

  &.${0} {
    animation-duration: ${0}ms;
  }

  & .${0} {
    opacity: 1;
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background-color: currentColor;
  }

  & .${0} {
    opacity: 0;
    animation-name: ${0};
    animation-duration: ${0}ms;
    animation-timing-function: ${0};
  }

  & .${0} {
    position: absolute;
    /* @noflip */
    left: 0px;
    top: 0;
    animation-name: ${0};
    animation-duration: 2500ms;
    animation-timing-function: ${0};
    animation-iteration-count: infinite;
    animation-delay: 200ms;
  }
`,J.rippleVisible,ve,$,({theme:e})=>e.transitions.easing.easeInOut,J.ripplePulsate,({theme:e})=>e.transitions.duration.shorter,J.child,J.childLeaving,ye,$,({theme:e})=>e.transitions.easing.easeInOut,J.childPulsate,be,({theme:e})=>e.transitions.easing.easeInOut),Ce=D.forwardRef(function(e,t){let n=o({props:e,name:`MuiTouchRipple`}),{center:r=!1,classes:i={},className:a}=n,s=S(n,Y),[c,l]=D.useState([]),u=D.useRef(0),d=D.useRef(null);D.useEffect(()=>{d.current&&=(d.current(),null)},[c]);let f=D.useRef(!1),p=D.useRef(null),m=D.useRef(null),g=D.useRef(null);D.useEffect(()=>()=>{clearTimeout(p.current)},[]);let _=D.useCallback(e=>{let{pulsate:t,rippleX:n,rippleY:r,rippleSize:a,cb:o}=e;l(e=>[...e,(0,q.jsx)(Se,{classes:{ripple:h(i.ripple,J.ripple),rippleVisible:h(i.rippleVisible,J.rippleVisible),ripplePulsate:h(i.ripplePulsate,J.ripplePulsate),child:h(i.child,J.child),childLeaving:h(i.childLeaving,J.childLeaving),childPulsate:h(i.childPulsate,J.childPulsate)},timeout:$,pulsate:t,rippleX:n,rippleY:r,rippleSize:a},u.current)]),u.current+=1,d.current=o},[i]),v=D.useCallback((e={},t={},n=()=>{})=>{let{pulsate:i=!1,center:a=r||t.pulsate,fakeElement:o=!1}=t;if(e?.type===`mousedown`&&f.current){f.current=!1;return}e?.type===`touchstart`&&(f.current=!0);let s=o?null:g.current,c=s?s.getBoundingClientRect():{width:0,height:0,left:0,top:0},l,u,d;if(a||e===void 0||e.clientX===0&&e.clientY===0||!e.clientX&&!e.touches)l=Math.round(c.width/2),u=Math.round(c.height/2);else{let{clientX:t,clientY:n}=e.touches&&e.touches.length>0?e.touches[0]:e;l=Math.round(t-c.left),u=Math.round(n-c.top)}if(a)d=Math.sqrt((2*c.width**2+c.height**2)/3),d%2==0&&(d+=1);else{let e=Math.max(Math.abs((s?s.clientWidth:0)-l),l)*2+2,t=Math.max(Math.abs((s?s.clientHeight:0)-u),u)*2+2;d=Math.sqrt(e**2+t**2)}e!=null&&e.touches?m.current===null&&(m.current=()=>{_({pulsate:i,rippleX:l,rippleY:u,rippleSize:d,cb:n})},p.current=setTimeout(()=>{m.current&&=(m.current(),null)},80)):_({pulsate:i,rippleX:l,rippleY:u,rippleSize:d,cb:n})},[r,_]),y=D.useCallback(()=>{v({},{pulsate:!0})},[v]),b=D.useCallback((e,t)=>{if(clearTimeout(p.current),e?.type===`touchend`&&m.current){m.current(),m.current=null,p.current=setTimeout(()=>{b(e,t)});return}m.current=null,l(e=>e.length>0?e.slice(1):e),d.current=t},[]);return D.useImperativeHandle(t,()=>({pulsate:y,start:v,stop:b}),[y,v,b]),(0,q.jsx)(xe,x({className:h(J.root,i.root,a),ref:g},s,{children:(0,q.jsx)(P,{component:null,exit:!0,children:c})}))});d(),T();function we(e){return u(`MuiButtonBase`,e)}var Te=b(`MuiButtonBase`,[`root`,`disabled`,`focusVisible`]);r(),i(),a(),m(),w();var Ee=`action.centerRipple.children.className.component.disabled.disableRipple.disableTouchRipple.focusRipple.focusVisibleClassName.LinkComponent.onBlur.onClick.onContextMenu.onDragLeave.onFocus.onFocusVisible.onKeyDown.onKeyUp.onMouseDown.onMouseLeave.onMouseUp.onTouchEnd.onTouchMove.onTouchStart.tabIndex.TouchRippleProps.touchRippleRef.type`.split(`.`),De=e=>{let{disabled:t,focusVisible:n,focusVisibleClassName:r,classes:i}=e,a=c({root:[`root`,t&&`disabled`,n&&`focusVisible`]},we,i);return n&&r&&(a.root+=` ${r}`),a},Oe=s(`button`,{name:`MuiButtonBase`,slot:`Root`,overridesResolver:(e,t)=>t.root})({display:`inline-flex`,alignItems:`center`,justifyContent:`center`,position:`relative`,boxSizing:`border-box`,WebkitTapHighlightColor:`transparent`,backgroundColor:`transparent`,outline:0,border:0,margin:0,borderRadius:0,padding:0,cursor:`pointer`,userSelect:`none`,verticalAlign:`middle`,MozAppearance:`none`,WebkitAppearance:`none`,textDecoration:`none`,color:`inherit`,"&::-moz-focus-inner":{borderStyle:`none`},[`&.${Te.disabled}`]:{pointerEvents:`none`,cursor:`default`},"@media print":{colorAdjust:`exact`}}),ke=D.forwardRef(function(e,t){let n=o({props:e,name:`MuiButtonBase`}),{action:r,centerRipple:i=!1,children:a,className:s,component:c=`button`,disabled:l=!1,disableRipple:u=!1,disableTouchRipple:d=!1,focusRipple:f=!1,LinkComponent:p=`a`,onBlur:m,onClick:g,onContextMenu:_,onDragLeave:v,onFocus:y,onFocusVisible:b,onKeyDown:ee,onKeyUp:C,onMouseDown:te,onMouseLeave:w,onMouseUp:T,onTouchEnd:E,onTouchMove:ne,onTouchStart:O,tabIndex:re=0,TouchRippleProps:k,touchRippleRef:ie,type:A}=n,j=S(n,Ee),M=D.useRef(null),N=D.useRef(null),ae=F(N,ie),{isFocusVisibleRef:P,onFocus:I,onBlur:oe,ref:L}=pe(),[R,z]=D.useState(!1);l&&R&&z(!1),D.useImperativeHandle(r,()=>({focusVisible:()=>{z(!0),M.current.focus()}}),[]);let[B,V]=D.useState(!1);D.useEffect(()=>{V(!0)},[]);let H=B&&!u&&!l;D.useEffect(()=>{R&&f&&!u&&B&&N.current.pulsate()},[u,f,R,B]);function U(e,t,n=d){return K(r=>(t&&t(r),!n&&N.current&&N.current[e](r),!0))}let W=U(`start`,te),se=U(`stop`,_),ce=U(`stop`,v),le=U(`stop`,T),G=U(`stop`,e=>{R&&e.preventDefault(),w&&w(e)}),ue=U(`start`,O),de=U(`stop`,E),fe=U(`stop`,ne),me=U(`stop`,e=>{oe(e),P.current===!1&&z(!1),m&&m(e)},!1),he=K(e=>{M.current||=e.currentTarget,I(e),P.current===!0&&(z(!0),b&&b(e)),y&&y(e)}),J=()=>{let e=M.current;return c&&c!==`button`&&!(e.tagName===`A`&&e.href)},Y=D.useRef(!1),X=K(e=>{f&&!Y.current&&R&&N.current&&e.key===` `&&(Y.current=!0,N.current.stop(e,()=>{N.current.start(e)})),e.target===e.currentTarget&&J()&&e.key===` `&&e.preventDefault(),ee&&ee(e),e.target===e.currentTarget&&J()&&e.key===`Enter`&&!l&&(e.preventDefault(),g&&g(e))}),ge=K(e=>{f&&e.key===` `&&N.current&&R&&!e.defaultPrevented&&(Y.current=!1,N.current.stop(e,()=>{N.current.pulsate(e)})),C&&C(e),g&&e.target===e.currentTarget&&J()&&e.key===` `&&!e.defaultPrevented&&g(e)}),Z=c;Z===`button`&&(j.href||j.to)&&(Z=p);let Q={};Z===`button`?(Q.type=A===void 0?`button`:A,Q.disabled=l):(!j.href&&!j.to&&(Q.role=`button`),l&&(Q[`aria-disabled`]=l));let _e=F(t,L,M),$=x({},n,{centerRipple:i,component:c,disabled:l,disableRipple:u,disableTouchRipple:d,focusRipple:f,tabIndex:re,focusVisible:R}),ve=De($);return(0,q.jsxs)(Oe,x({as:Z,className:h(ve.root,s),ownerState:$,onBlur:me,onClick:g,onContextMenu:se,onFocus:he,onKeyDown:X,onKeyUp:ge,onMouseDown:W,onMouseLeave:G,onMouseUp:le,onDragLeave:ce,onTouchEnd:de,onTouchMove:fe,onTouchStart:ue,ref:_e,tabIndex:l?-1:re,type:A},Q,j,{children:[a,H?(0,q.jsx)(Ce,x({ref:ae,center:i},k)):null]}))});export{K as a,I as c,ne as d,fe as i,F as l,me as n,le as o,pe as r,de as s,ke as t,O as u};