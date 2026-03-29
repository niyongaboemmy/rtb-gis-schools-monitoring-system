(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))i(r);new MutationObserver(r=>{for(const s of r)if(s.type==="childList")for(const o of s.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&i(o)}).observe(document,{childList:!0,subtree:!0});function t(r){const s={};return r.integrity&&(s.integrity=r.integrity),r.referrerPolicy&&(s.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?s.credentials="include":r.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function i(r){if(r.ep)return;r.ep=!0;const s=t(r);fetch(r.href,s)}})();function my(n){return n&&n.__esModule&&Object.prototype.hasOwnProperty.call(n,"default")?n.default:n}var i_={exports:{}},uu={},r_={exports:{}},at={};/**
 * @license React
 * react.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var ll=Symbol.for("react.element"),gy=Symbol.for("react.portal"),_y=Symbol.for("react.fragment"),xy=Symbol.for("react.strict_mode"),vy=Symbol.for("react.profiler"),yy=Symbol.for("react.provider"),Sy=Symbol.for("react.context"),My=Symbol.for("react.forward_ref"),Ey=Symbol.for("react.suspense"),wy=Symbol.for("react.memo"),Ty=Symbol.for("react.lazy"),cm=Symbol.iterator;function by(n){return n===null||typeof n!="object"?null:(n=cm&&n[cm]||n["@@iterator"],typeof n=="function"?n:null)}var s_={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},o_=Object.assign,a_={};function Go(n,e,t){this.props=n,this.context=e,this.refs=a_,this.updater=t||s_}Go.prototype.isReactComponent={};Go.prototype.setState=function(n,e){if(typeof n!="object"&&typeof n!="function"&&n!=null)throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,n,e,"setState")};Go.prototype.forceUpdate=function(n){this.updater.enqueueForceUpdate(this,n,"forceUpdate")};function l_(){}l_.prototype=Go.prototype;function Uh(n,e,t){this.props=n,this.context=e,this.refs=a_,this.updater=t||s_}var kh=Uh.prototype=new l_;kh.constructor=Uh;o_(kh,Go.prototype);kh.isPureReactComponent=!0;var um=Array.isArray,c_=Object.prototype.hasOwnProperty,Oh={current:null},u_={key:!0,ref:!0,__self:!0,__source:!0};function d_(n,e,t){var i,r={},s=null,o=null;if(e!=null)for(i in e.ref!==void 0&&(o=e.ref),e.key!==void 0&&(s=""+e.key),e)c_.call(e,i)&&!u_.hasOwnProperty(i)&&(r[i]=e[i]);var a=arguments.length-2;if(a===1)r.children=t;else if(1<a){for(var l=Array(a),c=0;c<a;c++)l[c]=arguments[c+2];r.children=l}if(n&&n.defaultProps)for(i in a=n.defaultProps,a)r[i]===void 0&&(r[i]=a[i]);return{$$typeof:ll,type:n,key:s,ref:o,props:r,_owner:Oh.current}}function Ay(n,e){return{$$typeof:ll,type:n.type,key:e,ref:n.ref,props:n.props,_owner:n._owner}}function Fh(n){return typeof n=="object"&&n!==null&&n.$$typeof===ll}function Ry(n){var e={"=":"=0",":":"=2"};return"$"+n.replace(/[=:]/g,function(t){return e[t]})}var dm=/\/+/g;function Du(n,e){return typeof n=="object"&&n!==null&&n.key!=null?Ry(""+n.key):e.toString(36)}function dc(n,e,t,i,r){var s=typeof n;(s==="undefined"||s==="boolean")&&(n=null);var o=!1;if(n===null)o=!0;else switch(s){case"string":case"number":o=!0;break;case"object":switch(n.$$typeof){case ll:case gy:o=!0}}if(o)return o=n,r=r(o),n=i===""?"."+Du(o,0):i,um(r)?(t="",n!=null&&(t=n.replace(dm,"$&/")+"/"),dc(r,e,t,"",function(c){return c})):r!=null&&(Fh(r)&&(r=Ay(r,t+(!r.key||o&&o.key===r.key?"":(""+r.key).replace(dm,"$&/")+"/")+n)),e.push(r)),1;if(o=0,i=i===""?".":i+":",um(n))for(var a=0;a<n.length;a++){s=n[a];var l=i+Du(s,a);o+=dc(s,e,t,l,r)}else if(l=by(n),typeof l=="function")for(n=l.call(n),a=0;!(s=n.next()).done;)s=s.value,l=i+Du(s,a++),o+=dc(s,e,t,l,r);else if(s==="object")throw e=String(n),Error("Objects are not valid as a React child (found: "+(e==="[object Object]"?"object with keys {"+Object.keys(n).join(", ")+"}":e)+"). If you meant to render a collection of children, use an array instead.");return o}function vl(n,e,t){if(n==null)return n;var i=[],r=0;return dc(n,i,"","",function(s){return e.call(t,s,r++)}),i}function Cy(n){if(n._status===-1){var e=n._result;e=e(),e.then(function(t){(n._status===0||n._status===-1)&&(n._status=1,n._result=t)},function(t){(n._status===0||n._status===-1)&&(n._status=2,n._result=t)}),n._status===-1&&(n._status=0,n._result=e)}if(n._status===1)return n._result.default;throw n._result}var Cn={current:null},fc={transition:null},Py={ReactCurrentDispatcher:Cn,ReactCurrentBatchConfig:fc,ReactCurrentOwner:Oh};function f_(){throw Error("act(...) is not supported in production builds of React.")}at.Children={map:vl,forEach:function(n,e,t){vl(n,function(){e.apply(this,arguments)},t)},count:function(n){var e=0;return vl(n,function(){e++}),e},toArray:function(n){return vl(n,function(e){return e})||[]},only:function(n){if(!Fh(n))throw Error("React.Children.only expected to receive a single React element child.");return n}};at.Component=Go;at.Fragment=_y;at.Profiler=vy;at.PureComponent=Uh;at.StrictMode=xy;at.Suspense=Ey;at.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=Py;at.act=f_;at.cloneElement=function(n,e,t){if(n==null)throw Error("React.cloneElement(...): The argument must be a React element, but you passed "+n+".");var i=o_({},n.props),r=n.key,s=n.ref,o=n._owner;if(e!=null){if(e.ref!==void 0&&(s=e.ref,o=Oh.current),e.key!==void 0&&(r=""+e.key),n.type&&n.type.defaultProps)var a=n.type.defaultProps;for(l in e)c_.call(e,l)&&!u_.hasOwnProperty(l)&&(i[l]=e[l]===void 0&&a!==void 0?a[l]:e[l])}var l=arguments.length-2;if(l===1)i.children=t;else if(1<l){a=Array(l);for(var c=0;c<l;c++)a[c]=arguments[c+2];i.children=a}return{$$typeof:ll,type:n.type,key:r,ref:s,props:i,_owner:o}};at.createContext=function(n){return n={$$typeof:Sy,_currentValue:n,_currentValue2:n,_threadCount:0,Provider:null,Consumer:null,_defaultValue:null,_globalName:null},n.Provider={$$typeof:yy,_context:n},n.Consumer=n};at.createElement=d_;at.createFactory=function(n){var e=d_.bind(null,n);return e.type=n,e};at.createRef=function(){return{current:null}};at.forwardRef=function(n){return{$$typeof:My,render:n}};at.isValidElement=Fh;at.lazy=function(n){return{$$typeof:Ty,_payload:{_status:-1,_result:n},_init:Cy}};at.memo=function(n,e){return{$$typeof:wy,type:n,compare:e===void 0?null:e}};at.startTransition=function(n){var e=fc.transition;fc.transition={};try{n()}finally{fc.transition=e}};at.unstable_act=f_;at.useCallback=function(n,e){return Cn.current.useCallback(n,e)};at.useContext=function(n){return Cn.current.useContext(n)};at.useDebugValue=function(){};at.useDeferredValue=function(n){return Cn.current.useDeferredValue(n)};at.useEffect=function(n,e){return Cn.current.useEffect(n,e)};at.useId=function(){return Cn.current.useId()};at.useImperativeHandle=function(n,e,t){return Cn.current.useImperativeHandle(n,e,t)};at.useInsertionEffect=function(n,e){return Cn.current.useInsertionEffect(n,e)};at.useLayoutEffect=function(n,e){return Cn.current.useLayoutEffect(n,e)};at.useMemo=function(n,e){return Cn.current.useMemo(n,e)};at.useReducer=function(n,e,t){return Cn.current.useReducer(n,e,t)};at.useRef=function(n){return Cn.current.useRef(n)};at.useState=function(n){return Cn.current.useState(n)};at.useSyncExternalStore=function(n,e,t){return Cn.current.useSyncExternalStore(n,e,t)};at.useTransition=function(){return Cn.current.useTransition()};at.version="18.3.1";r_.exports=at;var q=r_.exports;const Ly=my(q);/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var Ny=q,Dy=Symbol.for("react.element"),Iy=Symbol.for("react.fragment"),Uy=Object.prototype.hasOwnProperty,ky=Ny.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,Oy={key:!0,ref:!0,__self:!0,__source:!0};function h_(n,e,t){var i,r={},s=null,o=null;t!==void 0&&(s=""+t),e.key!==void 0&&(s=""+e.key),e.ref!==void 0&&(o=e.ref);for(i in e)Uy.call(e,i)&&!Oy.hasOwnProperty(i)&&(r[i]=e[i]);if(n&&n.defaultProps)for(i in e=n.defaultProps,e)r[i]===void 0&&(r[i]=e[i]);return{$$typeof:Dy,type:n,key:s,ref:o,props:r,_owner:ky.current}}uu.Fragment=Iy;uu.jsx=h_;uu.jsxs=h_;i_.exports=uu;var R=i_.exports,Kd={},p_={exports:{}},$n={},m_={exports:{}},g_={};/**
 * @license React
 * scheduler.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */(function(n){function e(U,ie){var re=U.length;U.push(ie);e:for(;0<re;){var fe=re-1>>>1,Oe=U[fe];if(0<r(Oe,ie))U[fe]=ie,U[re]=Oe,re=fe;else break e}}function t(U){return U.length===0?null:U[0]}function i(U){if(U.length===0)return null;var ie=U[0],re=U.pop();if(re!==ie){U[0]=re;e:for(var fe=0,Oe=U.length,it=Oe>>>1;fe<it;){var Y=2*(fe+1)-1,ae=U[Y],Me=Y+1,ve=U[Me];if(0>r(ae,re))Me<Oe&&0>r(ve,ae)?(U[fe]=ve,U[Me]=re,fe=Me):(U[fe]=ae,U[Y]=re,fe=Y);else if(Me<Oe&&0>r(ve,re))U[fe]=ve,U[Me]=re,fe=Me;else break e}}return ie}function r(U,ie){var re=U.sortIndex-ie.sortIndex;return re!==0?re:U.id-ie.id}if(typeof performance=="object"&&typeof performance.now=="function"){var s=performance;n.unstable_now=function(){return s.now()}}else{var o=Date,a=o.now();n.unstable_now=function(){return o.now()-a}}var l=[],c=[],u=1,d=null,f=3,p=!1,g=!1,v=!1,m=typeof setTimeout=="function"?setTimeout:null,h=typeof clearTimeout=="function"?clearTimeout:null,_=typeof setImmediate<"u"?setImmediate:null;typeof navigator<"u"&&navigator.scheduling!==void 0&&navigator.scheduling.isInputPending!==void 0&&navigator.scheduling.isInputPending.bind(navigator.scheduling);function x(U){for(var ie=t(c);ie!==null;){if(ie.callback===null)i(c);else if(ie.startTime<=U)i(c),ie.sortIndex=ie.expirationTime,e(l,ie);else break;ie=t(c)}}function M(U){if(v=!1,x(U),!g)if(t(l)!==null)g=!0,j(L);else{var ie=t(c);ie!==null&&Q(M,ie.startTime-U)}}function L(U,ie){g=!1,v&&(v=!1,h(I),I=-1),p=!0;var re=f;try{for(x(ie),d=t(l);d!==null&&(!(d.expirationTime>ie)||U&&!w());){var fe=d.callback;if(typeof fe=="function"){d.callback=null,f=d.priorityLevel;var Oe=fe(d.expirationTime<=ie);ie=n.unstable_now(),typeof Oe=="function"?d.callback=Oe:d===t(l)&&i(l),x(ie)}else i(l);d=t(l)}if(d!==null)var it=!0;else{var Y=t(c);Y!==null&&Q(M,Y.startTime-ie),it=!1}return it}finally{d=null,f=re,p=!1}}var A=!1,T=null,I=-1,K=5,y=-1;function w(){return!(n.unstable_now()-y<K)}function X(){if(T!==null){var U=n.unstable_now();y=U;var ie=!0;try{ie=T(!0,U)}finally{ie?W():(A=!1,T=null)}}else A=!1}var W;if(typeof _=="function")W=function(){_(X)};else if(typeof MessageChannel<"u"){var $=new MessageChannel,se=$.port2;$.port1.onmessage=X,W=function(){se.postMessage(null)}}else W=function(){m(X,0)};function j(U){T=U,A||(A=!0,W())}function Q(U,ie){I=m(function(){U(n.unstable_now())},ie)}n.unstable_IdlePriority=5,n.unstable_ImmediatePriority=1,n.unstable_LowPriority=4,n.unstable_NormalPriority=3,n.unstable_Profiling=null,n.unstable_UserBlockingPriority=2,n.unstable_cancelCallback=function(U){U.callback=null},n.unstable_continueExecution=function(){g||p||(g=!0,j(L))},n.unstable_forceFrameRate=function(U){0>U||125<U?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):K=0<U?Math.floor(1e3/U):5},n.unstable_getCurrentPriorityLevel=function(){return f},n.unstable_getFirstCallbackNode=function(){return t(l)},n.unstable_next=function(U){switch(f){case 1:case 2:case 3:var ie=3;break;default:ie=f}var re=f;f=ie;try{return U()}finally{f=re}},n.unstable_pauseExecution=function(){},n.unstable_requestPaint=function(){},n.unstable_runWithPriority=function(U,ie){switch(U){case 1:case 2:case 3:case 4:case 5:break;default:U=3}var re=f;f=U;try{return ie()}finally{f=re}},n.unstable_scheduleCallback=function(U,ie,re){var fe=n.unstable_now();switch(typeof re=="object"&&re!==null?(re=re.delay,re=typeof re=="number"&&0<re?fe+re:fe):re=fe,U){case 1:var Oe=-1;break;case 2:Oe=250;break;case 5:Oe=1073741823;break;case 4:Oe=1e4;break;default:Oe=5e3}return Oe=re+Oe,U={id:u++,callback:ie,priorityLevel:U,startTime:re,expirationTime:Oe,sortIndex:-1},re>fe?(U.sortIndex=re,e(c,U),t(l)===null&&U===t(c)&&(v?(h(I),I=-1):v=!0,Q(M,re-fe))):(U.sortIndex=Oe,e(l,U),g||p||(g=!0,j(L))),U},n.unstable_shouldYield=w,n.unstable_wrapCallback=function(U){var ie=f;return function(){var re=f;f=ie;try{return U.apply(this,arguments)}finally{f=re}}}})(g_);m_.exports=g_;var Fy=m_.exports;/**
 * @license React
 * react-dom.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var By=q,qn=Fy;function le(n){for(var e="https://reactjs.org/docs/error-decoder.html?invariant="+n,t=1;t<arguments.length;t++)e+="&args[]="+encodeURIComponent(arguments[t]);return"Minified React error #"+n+"; visit "+e+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}var __=new Set,Ha={};function Ls(n,e){To(n,e),To(n+"Capture",e)}function To(n,e){for(Ha[n]=e,n=0;n<e.length;n++)__.add(e[n])}var fr=!(typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"),qd=Object.prototype.hasOwnProperty,zy=/^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/,fm={},hm={};function Hy(n){return qd.call(hm,n)?!0:qd.call(fm,n)?!1:zy.test(n)?hm[n]=!0:(fm[n]=!0,!1)}function Vy(n,e,t,i){if(t!==null&&t.type===0)return!1;switch(typeof e){case"function":case"symbol":return!0;case"boolean":return i?!1:t!==null?!t.acceptsBooleans:(n=n.toLowerCase().slice(0,5),n!=="data-"&&n!=="aria-");default:return!1}}function Gy(n,e,t,i){if(e===null||typeof e>"u"||Vy(n,e,t,i))return!0;if(i)return!1;if(t!==null)switch(t.type){case 3:return!e;case 4:return e===!1;case 5:return isNaN(e);case 6:return isNaN(e)||1>e}return!1}function Pn(n,e,t,i,r,s,o){this.acceptsBooleans=e===2||e===3||e===4,this.attributeName=i,this.attributeNamespace=r,this.mustUseProperty=t,this.propertyName=n,this.type=e,this.sanitizeURL=s,this.removeEmptyString=o}var pn={};"children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(n){pn[n]=new Pn(n,0,!1,n,null,!1,!1)});[["acceptCharset","accept-charset"],["className","class"],["htmlFor","for"],["httpEquiv","http-equiv"]].forEach(function(n){var e=n[0];pn[e]=new Pn(e,1,!1,n[1],null,!1,!1)});["contentEditable","draggable","spellCheck","value"].forEach(function(n){pn[n]=new Pn(n,2,!1,n.toLowerCase(),null,!1,!1)});["autoReverse","externalResourcesRequired","focusable","preserveAlpha"].forEach(function(n){pn[n]=new Pn(n,2,!1,n,null,!1,!1)});"allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(n){pn[n]=new Pn(n,3,!1,n.toLowerCase(),null,!1,!1)});["checked","multiple","muted","selected"].forEach(function(n){pn[n]=new Pn(n,3,!0,n,null,!1,!1)});["capture","download"].forEach(function(n){pn[n]=new Pn(n,4,!1,n,null,!1,!1)});["cols","rows","size","span"].forEach(function(n){pn[n]=new Pn(n,6,!1,n,null,!1,!1)});["rowSpan","start"].forEach(function(n){pn[n]=new Pn(n,5,!1,n.toLowerCase(),null,!1,!1)});var Bh=/[\-:]([a-z])/g;function zh(n){return n[1].toUpperCase()}"accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(n){var e=n.replace(Bh,zh);pn[e]=new Pn(e,1,!1,n,null,!1,!1)});"xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(n){var e=n.replace(Bh,zh);pn[e]=new Pn(e,1,!1,n,"http://www.w3.org/1999/xlink",!1,!1)});["xml:base","xml:lang","xml:space"].forEach(function(n){var e=n.replace(Bh,zh);pn[e]=new Pn(e,1,!1,n,"http://www.w3.org/XML/1998/namespace",!1,!1)});["tabIndex","crossOrigin"].forEach(function(n){pn[n]=new Pn(n,1,!1,n.toLowerCase(),null,!1,!1)});pn.xlinkHref=new Pn("xlinkHref",1,!1,"xlink:href","http://www.w3.org/1999/xlink",!0,!1);["src","href","action","formAction"].forEach(function(n){pn[n]=new Pn(n,1,!1,n.toLowerCase(),null,!0,!0)});function Hh(n,e,t,i){var r=pn.hasOwnProperty(e)?pn[e]:null;(r!==null?r.type!==0:i||!(2<e.length)||e[0]!=="o"&&e[0]!=="O"||e[1]!=="n"&&e[1]!=="N")&&(Gy(e,t,r,i)&&(t=null),i||r===null?Hy(e)&&(t===null?n.removeAttribute(e):n.setAttribute(e,""+t)):r.mustUseProperty?n[r.propertyName]=t===null?r.type===3?!1:"":t:(e=r.attributeName,i=r.attributeNamespace,t===null?n.removeAttribute(e):(r=r.type,t=r===3||r===4&&t===!0?"":""+t,i?n.setAttributeNS(i,e,t):n.setAttribute(e,t))))}var _r=By.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,yl=Symbol.for("react.element"),Qs=Symbol.for("react.portal"),eo=Symbol.for("react.fragment"),Vh=Symbol.for("react.strict_mode"),$d=Symbol.for("react.profiler"),x_=Symbol.for("react.provider"),v_=Symbol.for("react.context"),Gh=Symbol.for("react.forward_ref"),Zd=Symbol.for("react.suspense"),Jd=Symbol.for("react.suspense_list"),Wh=Symbol.for("react.memo"),Cr=Symbol.for("react.lazy"),y_=Symbol.for("react.offscreen"),pm=Symbol.iterator;function na(n){return n===null||typeof n!="object"?null:(n=pm&&n[pm]||n["@@iterator"],typeof n=="function"?n:null)}var zt=Object.assign,Iu;function Ea(n){if(Iu===void 0)try{throw Error()}catch(t){var e=t.stack.trim().match(/\n( *(at )?)/);Iu=e&&e[1]||""}return`
`+Iu+n}var Uu=!1;function ku(n,e){if(!n||Uu)return"";Uu=!0;var t=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{if(e)if(e=function(){throw Error()},Object.defineProperty(e.prototype,"props",{set:function(){throw Error()}}),typeof Reflect=="object"&&Reflect.construct){try{Reflect.construct(e,[])}catch(c){var i=c}Reflect.construct(n,[],e)}else{try{e.call()}catch(c){i=c}n.call(e.prototype)}else{try{throw Error()}catch(c){i=c}n()}}catch(c){if(c&&i&&typeof c.stack=="string"){for(var r=c.stack.split(`
`),s=i.stack.split(`
`),o=r.length-1,a=s.length-1;1<=o&&0<=a&&r[o]!==s[a];)a--;for(;1<=o&&0<=a;o--,a--)if(r[o]!==s[a]){if(o!==1||a!==1)do if(o--,a--,0>a||r[o]!==s[a]){var l=`
`+r[o].replace(" at new "," at ");return n.displayName&&l.includes("<anonymous>")&&(l=l.replace("<anonymous>",n.displayName)),l}while(1<=o&&0<=a);break}}}finally{Uu=!1,Error.prepareStackTrace=t}return(n=n?n.displayName||n.name:"")?Ea(n):""}function Wy(n){switch(n.tag){case 5:return Ea(n.type);case 16:return Ea("Lazy");case 13:return Ea("Suspense");case 19:return Ea("SuspenseList");case 0:case 2:case 15:return n=ku(n.type,!1),n;case 11:return n=ku(n.type.render,!1),n;case 1:return n=ku(n.type,!0),n;default:return""}}function Qd(n){if(n==null)return null;if(typeof n=="function")return n.displayName||n.name||null;if(typeof n=="string")return n;switch(n){case eo:return"Fragment";case Qs:return"Portal";case $d:return"Profiler";case Vh:return"StrictMode";case Zd:return"Suspense";case Jd:return"SuspenseList"}if(typeof n=="object")switch(n.$$typeof){case v_:return(n.displayName||"Context")+".Consumer";case x_:return(n._context.displayName||"Context")+".Provider";case Gh:var e=n.render;return n=n.displayName,n||(n=e.displayName||e.name||"",n=n!==""?"ForwardRef("+n+")":"ForwardRef"),n;case Wh:return e=n.displayName||null,e!==null?e:Qd(n.type)||"Memo";case Cr:e=n._payload,n=n._init;try{return Qd(n(e))}catch{}}return null}function jy(n){var e=n.type;switch(n.tag){case 24:return"Cache";case 9:return(e.displayName||"Context")+".Consumer";case 10:return(e._context.displayName||"Context")+".Provider";case 18:return"DehydratedFragment";case 11:return n=e.render,n=n.displayName||n.name||"",e.displayName||(n!==""?"ForwardRef("+n+")":"ForwardRef");case 7:return"Fragment";case 5:return e;case 4:return"Portal";case 3:return"Root";case 6:return"Text";case 16:return Qd(e);case 8:return e===Vh?"StrictMode":"Mode";case 22:return"Offscreen";case 12:return"Profiler";case 21:return"Scope";case 13:return"Suspense";case 19:return"SuspenseList";case 25:return"TracingMarker";case 1:case 0:case 17:case 2:case 14:case 15:if(typeof e=="function")return e.displayName||e.name||null;if(typeof e=="string")return e}return null}function Yr(n){switch(typeof n){case"boolean":case"number":case"string":case"undefined":return n;case"object":return n;default:return""}}function S_(n){var e=n.type;return(n=n.nodeName)&&n.toLowerCase()==="input"&&(e==="checkbox"||e==="radio")}function Xy(n){var e=S_(n)?"checked":"value",t=Object.getOwnPropertyDescriptor(n.constructor.prototype,e),i=""+n[e];if(!n.hasOwnProperty(e)&&typeof t<"u"&&typeof t.get=="function"&&typeof t.set=="function"){var r=t.get,s=t.set;return Object.defineProperty(n,e,{configurable:!0,get:function(){return r.call(this)},set:function(o){i=""+o,s.call(this,o)}}),Object.defineProperty(n,e,{enumerable:t.enumerable}),{getValue:function(){return i},setValue:function(o){i=""+o},stopTracking:function(){n._valueTracker=null,delete n[e]}}}}function Sl(n){n._valueTracker||(n._valueTracker=Xy(n))}function M_(n){if(!n)return!1;var e=n._valueTracker;if(!e)return!0;var t=e.getValue(),i="";return n&&(i=S_(n)?n.checked?"true":"false":n.value),n=i,n!==t?(e.setValue(n),!0):!1}function Lc(n){if(n=n||(typeof document<"u"?document:void 0),typeof n>"u")return null;try{return n.activeElement||n.body}catch{return n.body}}function ef(n,e){var t=e.checked;return zt({},e,{defaultChecked:void 0,defaultValue:void 0,value:void 0,checked:t??n._wrapperState.initialChecked})}function mm(n,e){var t=e.defaultValue==null?"":e.defaultValue,i=e.checked!=null?e.checked:e.defaultChecked;t=Yr(e.value!=null?e.value:t),n._wrapperState={initialChecked:i,initialValue:t,controlled:e.type==="checkbox"||e.type==="radio"?e.checked!=null:e.value!=null}}function E_(n,e){e=e.checked,e!=null&&Hh(n,"checked",e,!1)}function tf(n,e){E_(n,e);var t=Yr(e.value),i=e.type;if(t!=null)i==="number"?(t===0&&n.value===""||n.value!=t)&&(n.value=""+t):n.value!==""+t&&(n.value=""+t);else if(i==="submit"||i==="reset"){n.removeAttribute("value");return}e.hasOwnProperty("value")?nf(n,e.type,t):e.hasOwnProperty("defaultValue")&&nf(n,e.type,Yr(e.defaultValue)),e.checked==null&&e.defaultChecked!=null&&(n.defaultChecked=!!e.defaultChecked)}function gm(n,e,t){if(e.hasOwnProperty("value")||e.hasOwnProperty("defaultValue")){var i=e.type;if(!(i!=="submit"&&i!=="reset"||e.value!==void 0&&e.value!==null))return;e=""+n._wrapperState.initialValue,t||e===n.value||(n.value=e),n.defaultValue=e}t=n.name,t!==""&&(n.name=""),n.defaultChecked=!!n._wrapperState.initialChecked,t!==""&&(n.name=t)}function nf(n,e,t){(e!=="number"||Lc(n.ownerDocument)!==n)&&(t==null?n.defaultValue=""+n._wrapperState.initialValue:n.defaultValue!==""+t&&(n.defaultValue=""+t))}var wa=Array.isArray;function po(n,e,t,i){if(n=n.options,e){e={};for(var r=0;r<t.length;r++)e["$"+t[r]]=!0;for(t=0;t<n.length;t++)r=e.hasOwnProperty("$"+n[t].value),n[t].selected!==r&&(n[t].selected=r),r&&i&&(n[t].defaultSelected=!0)}else{for(t=""+Yr(t),e=null,r=0;r<n.length;r++){if(n[r].value===t){n[r].selected=!0,i&&(n[r].defaultSelected=!0);return}e!==null||n[r].disabled||(e=n[r])}e!==null&&(e.selected=!0)}}function rf(n,e){if(e.dangerouslySetInnerHTML!=null)throw Error(le(91));return zt({},e,{value:void 0,defaultValue:void 0,children:""+n._wrapperState.initialValue})}function _m(n,e){var t=e.value;if(t==null){if(t=e.children,e=e.defaultValue,t!=null){if(e!=null)throw Error(le(92));if(wa(t)){if(1<t.length)throw Error(le(93));t=t[0]}e=t}e==null&&(e=""),t=e}n._wrapperState={initialValue:Yr(t)}}function w_(n,e){var t=Yr(e.value),i=Yr(e.defaultValue);t!=null&&(t=""+t,t!==n.value&&(n.value=t),e.defaultValue==null&&n.defaultValue!==t&&(n.defaultValue=t)),i!=null&&(n.defaultValue=""+i)}function xm(n){var e=n.textContent;e===n._wrapperState.initialValue&&e!==""&&e!==null&&(n.value=e)}function T_(n){switch(n){case"svg":return"http://www.w3.org/2000/svg";case"math":return"http://www.w3.org/1998/Math/MathML";default:return"http://www.w3.org/1999/xhtml"}}function sf(n,e){return n==null||n==="http://www.w3.org/1999/xhtml"?T_(e):n==="http://www.w3.org/2000/svg"&&e==="foreignObject"?"http://www.w3.org/1999/xhtml":n}var Ml,b_=function(n){return typeof MSApp<"u"&&MSApp.execUnsafeLocalFunction?function(e,t,i,r){MSApp.execUnsafeLocalFunction(function(){return n(e,t,i,r)})}:n}(function(n,e){if(n.namespaceURI!=="http://www.w3.org/2000/svg"||"innerHTML"in n)n.innerHTML=e;else{for(Ml=Ml||document.createElement("div"),Ml.innerHTML="<svg>"+e.valueOf().toString()+"</svg>",e=Ml.firstChild;n.firstChild;)n.removeChild(n.firstChild);for(;e.firstChild;)n.appendChild(e.firstChild)}});function Va(n,e){if(e){var t=n.firstChild;if(t&&t===n.lastChild&&t.nodeType===3){t.nodeValue=e;return}}n.textContent=e}var Ca={animationIterationCount:!0,aspectRatio:!0,borderImageOutset:!0,borderImageSlice:!0,borderImageWidth:!0,boxFlex:!0,boxFlexGroup:!0,boxOrdinalGroup:!0,columnCount:!0,columns:!0,flex:!0,flexGrow:!0,flexPositive:!0,flexShrink:!0,flexNegative:!0,flexOrder:!0,gridArea:!0,gridRow:!0,gridRowEnd:!0,gridRowSpan:!0,gridRowStart:!0,gridColumn:!0,gridColumnEnd:!0,gridColumnSpan:!0,gridColumnStart:!0,fontWeight:!0,lineClamp:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,tabSize:!0,widows:!0,zIndex:!0,zoom:!0,fillOpacity:!0,floodOpacity:!0,stopOpacity:!0,strokeDasharray:!0,strokeDashoffset:!0,strokeMiterlimit:!0,strokeOpacity:!0,strokeWidth:!0},Yy=["Webkit","ms","Moz","O"];Object.keys(Ca).forEach(function(n){Yy.forEach(function(e){e=e+n.charAt(0).toUpperCase()+n.substring(1),Ca[e]=Ca[n]})});function A_(n,e,t){return e==null||typeof e=="boolean"||e===""?"":t||typeof e!="number"||e===0||Ca.hasOwnProperty(n)&&Ca[n]?(""+e).trim():e+"px"}function R_(n,e){n=n.style;for(var t in e)if(e.hasOwnProperty(t)){var i=t.indexOf("--")===0,r=A_(t,e[t],i);t==="float"&&(t="cssFloat"),i?n.setProperty(t,r):n[t]=r}}var Ky=zt({menuitem:!0},{area:!0,base:!0,br:!0,col:!0,embed:!0,hr:!0,img:!0,input:!0,keygen:!0,link:!0,meta:!0,param:!0,source:!0,track:!0,wbr:!0});function of(n,e){if(e){if(Ky[n]&&(e.children!=null||e.dangerouslySetInnerHTML!=null))throw Error(le(137,n));if(e.dangerouslySetInnerHTML!=null){if(e.children!=null)throw Error(le(60));if(typeof e.dangerouslySetInnerHTML!="object"||!("__html"in e.dangerouslySetInnerHTML))throw Error(le(61))}if(e.style!=null&&typeof e.style!="object")throw Error(le(62))}}function af(n,e){if(n.indexOf("-")===-1)return typeof e.is=="string";switch(n){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}var lf=null;function jh(n){return n=n.target||n.srcElement||window,n.correspondingUseElement&&(n=n.correspondingUseElement),n.nodeType===3?n.parentNode:n}var cf=null,mo=null,go=null;function vm(n){if(n=dl(n)){if(typeof cf!="function")throw Error(le(280));var e=n.stateNode;e&&(e=mu(e),cf(n.stateNode,n.type,e))}}function C_(n){mo?go?go.push(n):go=[n]:mo=n}function P_(){if(mo){var n=mo,e=go;if(go=mo=null,vm(n),e)for(n=0;n<e.length;n++)vm(e[n])}}function L_(n,e){return n(e)}function N_(){}var Ou=!1;function D_(n,e,t){if(Ou)return n(e,t);Ou=!0;try{return L_(n,e,t)}finally{Ou=!1,(mo!==null||go!==null)&&(N_(),P_())}}function Ga(n,e){var t=n.stateNode;if(t===null)return null;var i=mu(t);if(i===null)return null;t=i[e];e:switch(e){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(i=!i.disabled)||(n=n.type,i=!(n==="button"||n==="input"||n==="select"||n==="textarea")),n=!i;break e;default:n=!1}if(n)return null;if(t&&typeof t!="function")throw Error(le(231,e,typeof t));return t}var uf=!1;if(fr)try{var ia={};Object.defineProperty(ia,"passive",{get:function(){uf=!0}}),window.addEventListener("test",ia,ia),window.removeEventListener("test",ia,ia)}catch{uf=!1}function qy(n,e,t,i,r,s,o,a,l){var c=Array.prototype.slice.call(arguments,3);try{e.apply(t,c)}catch(u){this.onError(u)}}var Pa=!1,Nc=null,Dc=!1,df=null,$y={onError:function(n){Pa=!0,Nc=n}};function Zy(n,e,t,i,r,s,o,a,l){Pa=!1,Nc=null,qy.apply($y,arguments)}function Jy(n,e,t,i,r,s,o,a,l){if(Zy.apply(this,arguments),Pa){if(Pa){var c=Nc;Pa=!1,Nc=null}else throw Error(le(198));Dc||(Dc=!0,df=c)}}function Ns(n){var e=n,t=n;if(n.alternate)for(;e.return;)e=e.return;else{n=e;do e=n,e.flags&4098&&(t=e.return),n=e.return;while(n)}return e.tag===3?t:null}function I_(n){if(n.tag===13){var e=n.memoizedState;if(e===null&&(n=n.alternate,n!==null&&(e=n.memoizedState)),e!==null)return e.dehydrated}return null}function ym(n){if(Ns(n)!==n)throw Error(le(188))}function Qy(n){var e=n.alternate;if(!e){if(e=Ns(n),e===null)throw Error(le(188));return e!==n?null:n}for(var t=n,i=e;;){var r=t.return;if(r===null)break;var s=r.alternate;if(s===null){if(i=r.return,i!==null){t=i;continue}break}if(r.child===s.child){for(s=r.child;s;){if(s===t)return ym(r),n;if(s===i)return ym(r),e;s=s.sibling}throw Error(le(188))}if(t.return!==i.return)t=r,i=s;else{for(var o=!1,a=r.child;a;){if(a===t){o=!0,t=r,i=s;break}if(a===i){o=!0,i=r,t=s;break}a=a.sibling}if(!o){for(a=s.child;a;){if(a===t){o=!0,t=s,i=r;break}if(a===i){o=!0,i=s,t=r;break}a=a.sibling}if(!o)throw Error(le(189))}}if(t.alternate!==i)throw Error(le(190))}if(t.tag!==3)throw Error(le(188));return t.stateNode.current===t?n:e}function U_(n){return n=Qy(n),n!==null?k_(n):null}function k_(n){if(n.tag===5||n.tag===6)return n;for(n=n.child;n!==null;){var e=k_(n);if(e!==null)return e;n=n.sibling}return null}var O_=qn.unstable_scheduleCallback,Sm=qn.unstable_cancelCallback,eS=qn.unstable_shouldYield,tS=qn.unstable_requestPaint,Xt=qn.unstable_now,nS=qn.unstable_getCurrentPriorityLevel,Xh=qn.unstable_ImmediatePriority,F_=qn.unstable_UserBlockingPriority,Ic=qn.unstable_NormalPriority,iS=qn.unstable_LowPriority,B_=qn.unstable_IdlePriority,du=null,Fi=null;function rS(n){if(Fi&&typeof Fi.onCommitFiberRoot=="function")try{Fi.onCommitFiberRoot(du,n,void 0,(n.current.flags&128)===128)}catch{}}var Ei=Math.clz32?Math.clz32:aS,sS=Math.log,oS=Math.LN2;function aS(n){return n>>>=0,n===0?32:31-(sS(n)/oS|0)|0}var El=64,wl=4194304;function Ta(n){switch(n&-n){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return n&4194240;case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:return n&130023424;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 1073741824;default:return n}}function Uc(n,e){var t=n.pendingLanes;if(t===0)return 0;var i=0,r=n.suspendedLanes,s=n.pingedLanes,o=t&268435455;if(o!==0){var a=o&~r;a!==0?i=Ta(a):(s&=o,s!==0&&(i=Ta(s)))}else o=t&~r,o!==0?i=Ta(o):s!==0&&(i=Ta(s));if(i===0)return 0;if(e!==0&&e!==i&&!(e&r)&&(r=i&-i,s=e&-e,r>=s||r===16&&(s&4194240)!==0))return e;if(i&4&&(i|=t&16),e=n.entangledLanes,e!==0)for(n=n.entanglements,e&=i;0<e;)t=31-Ei(e),r=1<<t,i|=n[t],e&=~r;return i}function lS(n,e){switch(n){case 1:case 2:case 4:return e+250;case 8:case 16:case 32:case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return e+5e3;case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:return-1;case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function cS(n,e){for(var t=n.suspendedLanes,i=n.pingedLanes,r=n.expirationTimes,s=n.pendingLanes;0<s;){var o=31-Ei(s),a=1<<o,l=r[o];l===-1?(!(a&t)||a&i)&&(r[o]=lS(a,e)):l<=e&&(n.expiredLanes|=a),s&=~a}}function ff(n){return n=n.pendingLanes&-1073741825,n!==0?n:n&1073741824?1073741824:0}function z_(){var n=El;return El<<=1,!(El&4194240)&&(El=64),n}function Fu(n){for(var e=[],t=0;31>t;t++)e.push(n);return e}function cl(n,e,t){n.pendingLanes|=e,e!==536870912&&(n.suspendedLanes=0,n.pingedLanes=0),n=n.eventTimes,e=31-Ei(e),n[e]=t}function uS(n,e){var t=n.pendingLanes&~e;n.pendingLanes=e,n.suspendedLanes=0,n.pingedLanes=0,n.expiredLanes&=e,n.mutableReadLanes&=e,n.entangledLanes&=e,e=n.entanglements;var i=n.eventTimes;for(n=n.expirationTimes;0<t;){var r=31-Ei(t),s=1<<r;e[r]=0,i[r]=-1,n[r]=-1,t&=~s}}function Yh(n,e){var t=n.entangledLanes|=e;for(n=n.entanglements;t;){var i=31-Ei(t),r=1<<i;r&e|n[i]&e&&(n[i]|=e),t&=~r}}var wt=0;function H_(n){return n&=-n,1<n?4<n?n&268435455?16:536870912:4:1}var V_,Kh,G_,W_,j_,hf=!1,Tl=[],Fr=null,Br=null,zr=null,Wa=new Map,ja=new Map,Lr=[],dS="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");function Mm(n,e){switch(n){case"focusin":case"focusout":Fr=null;break;case"dragenter":case"dragleave":Br=null;break;case"mouseover":case"mouseout":zr=null;break;case"pointerover":case"pointerout":Wa.delete(e.pointerId);break;case"gotpointercapture":case"lostpointercapture":ja.delete(e.pointerId)}}function ra(n,e,t,i,r,s){return n===null||n.nativeEvent!==s?(n={blockedOn:e,domEventName:t,eventSystemFlags:i,nativeEvent:s,targetContainers:[r]},e!==null&&(e=dl(e),e!==null&&Kh(e)),n):(n.eventSystemFlags|=i,e=n.targetContainers,r!==null&&e.indexOf(r)===-1&&e.push(r),n)}function fS(n,e,t,i,r){switch(e){case"focusin":return Fr=ra(Fr,n,e,t,i,r),!0;case"dragenter":return Br=ra(Br,n,e,t,i,r),!0;case"mouseover":return zr=ra(zr,n,e,t,i,r),!0;case"pointerover":var s=r.pointerId;return Wa.set(s,ra(Wa.get(s)||null,n,e,t,i,r)),!0;case"gotpointercapture":return s=r.pointerId,ja.set(s,ra(ja.get(s)||null,n,e,t,i,r)),!0}return!1}function X_(n){var e=xs(n.target);if(e!==null){var t=Ns(e);if(t!==null){if(e=t.tag,e===13){if(e=I_(t),e!==null){n.blockedOn=e,j_(n.priority,function(){G_(t)});return}}else if(e===3&&t.stateNode.current.memoizedState.isDehydrated){n.blockedOn=t.tag===3?t.stateNode.containerInfo:null;return}}}n.blockedOn=null}function hc(n){if(n.blockedOn!==null)return!1;for(var e=n.targetContainers;0<e.length;){var t=pf(n.domEventName,n.eventSystemFlags,e[0],n.nativeEvent);if(t===null){t=n.nativeEvent;var i=new t.constructor(t.type,t);lf=i,t.target.dispatchEvent(i),lf=null}else return e=dl(t),e!==null&&Kh(e),n.blockedOn=t,!1;e.shift()}return!0}function Em(n,e,t){hc(n)&&t.delete(e)}function hS(){hf=!1,Fr!==null&&hc(Fr)&&(Fr=null),Br!==null&&hc(Br)&&(Br=null),zr!==null&&hc(zr)&&(zr=null),Wa.forEach(Em),ja.forEach(Em)}function sa(n,e){n.blockedOn===e&&(n.blockedOn=null,hf||(hf=!0,qn.unstable_scheduleCallback(qn.unstable_NormalPriority,hS)))}function Xa(n){function e(r){return sa(r,n)}if(0<Tl.length){sa(Tl[0],n);for(var t=1;t<Tl.length;t++){var i=Tl[t];i.blockedOn===n&&(i.blockedOn=null)}}for(Fr!==null&&sa(Fr,n),Br!==null&&sa(Br,n),zr!==null&&sa(zr,n),Wa.forEach(e),ja.forEach(e),t=0;t<Lr.length;t++)i=Lr[t],i.blockedOn===n&&(i.blockedOn=null);for(;0<Lr.length&&(t=Lr[0],t.blockedOn===null);)X_(t),t.blockedOn===null&&Lr.shift()}var _o=_r.ReactCurrentBatchConfig,kc=!0;function pS(n,e,t,i){var r=wt,s=_o.transition;_o.transition=null;try{wt=1,qh(n,e,t,i)}finally{wt=r,_o.transition=s}}function mS(n,e,t,i){var r=wt,s=_o.transition;_o.transition=null;try{wt=4,qh(n,e,t,i)}finally{wt=r,_o.transition=s}}function qh(n,e,t,i){if(kc){var r=pf(n,e,t,i);if(r===null)Ku(n,e,i,Oc,t),Mm(n,i);else if(fS(r,n,e,t,i))i.stopPropagation();else if(Mm(n,i),e&4&&-1<dS.indexOf(n)){for(;r!==null;){var s=dl(r);if(s!==null&&V_(s),s=pf(n,e,t,i),s===null&&Ku(n,e,i,Oc,t),s===r)break;r=s}r!==null&&i.stopPropagation()}else Ku(n,e,i,null,t)}}var Oc=null;function pf(n,e,t,i){if(Oc=null,n=jh(i),n=xs(n),n!==null)if(e=Ns(n),e===null)n=null;else if(t=e.tag,t===13){if(n=I_(e),n!==null)return n;n=null}else if(t===3){if(e.stateNode.current.memoizedState.isDehydrated)return e.tag===3?e.stateNode.containerInfo:null;n=null}else e!==n&&(n=null);return Oc=n,null}function Y_(n){switch(n){case"cancel":case"click":case"close":case"contextmenu":case"copy":case"cut":case"auxclick":case"dblclick":case"dragend":case"dragstart":case"drop":case"focusin":case"focusout":case"input":case"invalid":case"keydown":case"keypress":case"keyup":case"mousedown":case"mouseup":case"paste":case"pause":case"play":case"pointercancel":case"pointerdown":case"pointerup":case"ratechange":case"reset":case"resize":case"seeked":case"submit":case"touchcancel":case"touchend":case"touchstart":case"volumechange":case"change":case"selectionchange":case"textInput":case"compositionstart":case"compositionend":case"compositionupdate":case"beforeblur":case"afterblur":case"beforeinput":case"blur":case"fullscreenchange":case"focus":case"hashchange":case"popstate":case"select":case"selectstart":return 1;case"drag":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"mousemove":case"mouseout":case"mouseover":case"pointermove":case"pointerout":case"pointerover":case"scroll":case"toggle":case"touchmove":case"wheel":case"mouseenter":case"mouseleave":case"pointerenter":case"pointerleave":return 4;case"message":switch(nS()){case Xh:return 1;case F_:return 4;case Ic:case iS:return 16;case B_:return 536870912;default:return 16}default:return 16}}var Ir=null,$h=null,pc=null;function K_(){if(pc)return pc;var n,e=$h,t=e.length,i,r="value"in Ir?Ir.value:Ir.textContent,s=r.length;for(n=0;n<t&&e[n]===r[n];n++);var o=t-n;for(i=1;i<=o&&e[t-i]===r[s-i];i++);return pc=r.slice(n,1<i?1-i:void 0)}function mc(n){var e=n.keyCode;return"charCode"in n?(n=n.charCode,n===0&&e===13&&(n=13)):n=e,n===10&&(n=13),32<=n||n===13?n:0}function bl(){return!0}function wm(){return!1}function Zn(n){function e(t,i,r,s,o){this._reactName=t,this._targetInst=r,this.type=i,this.nativeEvent=s,this.target=o,this.currentTarget=null;for(var a in n)n.hasOwnProperty(a)&&(t=n[a],this[a]=t?t(s):s[a]);return this.isDefaultPrevented=(s.defaultPrevented!=null?s.defaultPrevented:s.returnValue===!1)?bl:wm,this.isPropagationStopped=wm,this}return zt(e.prototype,{preventDefault:function(){this.defaultPrevented=!0;var t=this.nativeEvent;t&&(t.preventDefault?t.preventDefault():typeof t.returnValue!="unknown"&&(t.returnValue=!1),this.isDefaultPrevented=bl)},stopPropagation:function(){var t=this.nativeEvent;t&&(t.stopPropagation?t.stopPropagation():typeof t.cancelBubble!="unknown"&&(t.cancelBubble=!0),this.isPropagationStopped=bl)},persist:function(){},isPersistent:bl}),e}var Wo={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(n){return n.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},Zh=Zn(Wo),ul=zt({},Wo,{view:0,detail:0}),gS=Zn(ul),Bu,zu,oa,fu=zt({},ul,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:Jh,button:0,buttons:0,relatedTarget:function(n){return n.relatedTarget===void 0?n.fromElement===n.srcElement?n.toElement:n.fromElement:n.relatedTarget},movementX:function(n){return"movementX"in n?n.movementX:(n!==oa&&(oa&&n.type==="mousemove"?(Bu=n.screenX-oa.screenX,zu=n.screenY-oa.screenY):zu=Bu=0,oa=n),Bu)},movementY:function(n){return"movementY"in n?n.movementY:zu}}),Tm=Zn(fu),_S=zt({},fu,{dataTransfer:0}),xS=Zn(_S),vS=zt({},ul,{relatedTarget:0}),Hu=Zn(vS),yS=zt({},Wo,{animationName:0,elapsedTime:0,pseudoElement:0}),SS=Zn(yS),MS=zt({},Wo,{clipboardData:function(n){return"clipboardData"in n?n.clipboardData:window.clipboardData}}),ES=Zn(MS),wS=zt({},Wo,{data:0}),bm=Zn(wS),TS={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},bS={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},AS={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function RS(n){var e=this.nativeEvent;return e.getModifierState?e.getModifierState(n):(n=AS[n])?!!e[n]:!1}function Jh(){return RS}var CS=zt({},ul,{key:function(n){if(n.key){var e=TS[n.key]||n.key;if(e!=="Unidentified")return e}return n.type==="keypress"?(n=mc(n),n===13?"Enter":String.fromCharCode(n)):n.type==="keydown"||n.type==="keyup"?bS[n.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:Jh,charCode:function(n){return n.type==="keypress"?mc(n):0},keyCode:function(n){return n.type==="keydown"||n.type==="keyup"?n.keyCode:0},which:function(n){return n.type==="keypress"?mc(n):n.type==="keydown"||n.type==="keyup"?n.keyCode:0}}),PS=Zn(CS),LS=zt({},fu,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),Am=Zn(LS),NS=zt({},ul,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:Jh}),DS=Zn(NS),IS=zt({},Wo,{propertyName:0,elapsedTime:0,pseudoElement:0}),US=Zn(IS),kS=zt({},fu,{deltaX:function(n){return"deltaX"in n?n.deltaX:"wheelDeltaX"in n?-n.wheelDeltaX:0},deltaY:function(n){return"deltaY"in n?n.deltaY:"wheelDeltaY"in n?-n.wheelDeltaY:"wheelDelta"in n?-n.wheelDelta:0},deltaZ:0,deltaMode:0}),OS=Zn(kS),FS=[9,13,27,32],Qh=fr&&"CompositionEvent"in window,La=null;fr&&"documentMode"in document&&(La=document.documentMode);var BS=fr&&"TextEvent"in window&&!La,q_=fr&&(!Qh||La&&8<La&&11>=La),Rm=" ",Cm=!1;function $_(n,e){switch(n){case"keyup":return FS.indexOf(e.keyCode)!==-1;case"keydown":return e.keyCode!==229;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function Z_(n){return n=n.detail,typeof n=="object"&&"data"in n?n.data:null}var to=!1;function zS(n,e){switch(n){case"compositionend":return Z_(e);case"keypress":return e.which!==32?null:(Cm=!0,Rm);case"textInput":return n=e.data,n===Rm&&Cm?null:n;default:return null}}function HS(n,e){if(to)return n==="compositionend"||!Qh&&$_(n,e)?(n=K_(),pc=$h=Ir=null,to=!1,n):null;switch(n){case"paste":return null;case"keypress":if(!(e.ctrlKey||e.altKey||e.metaKey)||e.ctrlKey&&e.altKey){if(e.char&&1<e.char.length)return e.char;if(e.which)return String.fromCharCode(e.which)}return null;case"compositionend":return q_&&e.locale!=="ko"?null:e.data;default:return null}}var VS={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function Pm(n){var e=n&&n.nodeName&&n.nodeName.toLowerCase();return e==="input"?!!VS[n.type]:e==="textarea"}function J_(n,e,t,i){C_(i),e=Fc(e,"onChange"),0<e.length&&(t=new Zh("onChange","change",null,t,i),n.push({event:t,listeners:e}))}var Na=null,Ya=null;function GS(n){cx(n,0)}function hu(n){var e=ro(n);if(M_(e))return n}function WS(n,e){if(n==="change")return e}var Q_=!1;if(fr){var Vu;if(fr){var Gu="oninput"in document;if(!Gu){var Lm=document.createElement("div");Lm.setAttribute("oninput","return;"),Gu=typeof Lm.oninput=="function"}Vu=Gu}else Vu=!1;Q_=Vu&&(!document.documentMode||9<document.documentMode)}function Nm(){Na&&(Na.detachEvent("onpropertychange",ex),Ya=Na=null)}function ex(n){if(n.propertyName==="value"&&hu(Ya)){var e=[];J_(e,Ya,n,jh(n)),D_(GS,e)}}function jS(n,e,t){n==="focusin"?(Nm(),Na=e,Ya=t,Na.attachEvent("onpropertychange",ex)):n==="focusout"&&Nm()}function XS(n){if(n==="selectionchange"||n==="keyup"||n==="keydown")return hu(Ya)}function YS(n,e){if(n==="click")return hu(e)}function KS(n,e){if(n==="input"||n==="change")return hu(e)}function qS(n,e){return n===e&&(n!==0||1/n===1/e)||n!==n&&e!==e}var Ai=typeof Object.is=="function"?Object.is:qS;function Ka(n,e){if(Ai(n,e))return!0;if(typeof n!="object"||n===null||typeof e!="object"||e===null)return!1;var t=Object.keys(n),i=Object.keys(e);if(t.length!==i.length)return!1;for(i=0;i<t.length;i++){var r=t[i];if(!qd.call(e,r)||!Ai(n[r],e[r]))return!1}return!0}function Dm(n){for(;n&&n.firstChild;)n=n.firstChild;return n}function Im(n,e){var t=Dm(n);n=0;for(var i;t;){if(t.nodeType===3){if(i=n+t.textContent.length,n<=e&&i>=e)return{node:t,offset:e-n};n=i}e:{for(;t;){if(t.nextSibling){t=t.nextSibling;break e}t=t.parentNode}t=void 0}t=Dm(t)}}function tx(n,e){return n&&e?n===e?!0:n&&n.nodeType===3?!1:e&&e.nodeType===3?tx(n,e.parentNode):"contains"in n?n.contains(e):n.compareDocumentPosition?!!(n.compareDocumentPosition(e)&16):!1:!1}function nx(){for(var n=window,e=Lc();e instanceof n.HTMLIFrameElement;){try{var t=typeof e.contentWindow.location.href=="string"}catch{t=!1}if(t)n=e.contentWindow;else break;e=Lc(n.document)}return e}function ep(n){var e=n&&n.nodeName&&n.nodeName.toLowerCase();return e&&(e==="input"&&(n.type==="text"||n.type==="search"||n.type==="tel"||n.type==="url"||n.type==="password")||e==="textarea"||n.contentEditable==="true")}function $S(n){var e=nx(),t=n.focusedElem,i=n.selectionRange;if(e!==t&&t&&t.ownerDocument&&tx(t.ownerDocument.documentElement,t)){if(i!==null&&ep(t)){if(e=i.start,n=i.end,n===void 0&&(n=e),"selectionStart"in t)t.selectionStart=e,t.selectionEnd=Math.min(n,t.value.length);else if(n=(e=t.ownerDocument||document)&&e.defaultView||window,n.getSelection){n=n.getSelection();var r=t.textContent.length,s=Math.min(i.start,r);i=i.end===void 0?s:Math.min(i.end,r),!n.extend&&s>i&&(r=i,i=s,s=r),r=Im(t,s);var o=Im(t,i);r&&o&&(n.rangeCount!==1||n.anchorNode!==r.node||n.anchorOffset!==r.offset||n.focusNode!==o.node||n.focusOffset!==o.offset)&&(e=e.createRange(),e.setStart(r.node,r.offset),n.removeAllRanges(),s>i?(n.addRange(e),n.extend(o.node,o.offset)):(e.setEnd(o.node,o.offset),n.addRange(e)))}}for(e=[],n=t;n=n.parentNode;)n.nodeType===1&&e.push({element:n,left:n.scrollLeft,top:n.scrollTop});for(typeof t.focus=="function"&&t.focus(),t=0;t<e.length;t++)n=e[t],n.element.scrollLeft=n.left,n.element.scrollTop=n.top}}var ZS=fr&&"documentMode"in document&&11>=document.documentMode,no=null,mf=null,Da=null,gf=!1;function Um(n,e,t){var i=t.window===t?t.document:t.nodeType===9?t:t.ownerDocument;gf||no==null||no!==Lc(i)||(i=no,"selectionStart"in i&&ep(i)?i={start:i.selectionStart,end:i.selectionEnd}:(i=(i.ownerDocument&&i.ownerDocument.defaultView||window).getSelection(),i={anchorNode:i.anchorNode,anchorOffset:i.anchorOffset,focusNode:i.focusNode,focusOffset:i.focusOffset}),Da&&Ka(Da,i)||(Da=i,i=Fc(mf,"onSelect"),0<i.length&&(e=new Zh("onSelect","select",null,e,t),n.push({event:e,listeners:i}),e.target=no)))}function Al(n,e){var t={};return t[n.toLowerCase()]=e.toLowerCase(),t["Webkit"+n]="webkit"+e,t["Moz"+n]="moz"+e,t}var io={animationend:Al("Animation","AnimationEnd"),animationiteration:Al("Animation","AnimationIteration"),animationstart:Al("Animation","AnimationStart"),transitionend:Al("Transition","TransitionEnd")},Wu={},ix={};fr&&(ix=document.createElement("div").style,"AnimationEvent"in window||(delete io.animationend.animation,delete io.animationiteration.animation,delete io.animationstart.animation),"TransitionEvent"in window||delete io.transitionend.transition);function pu(n){if(Wu[n])return Wu[n];if(!io[n])return n;var e=io[n],t;for(t in e)if(e.hasOwnProperty(t)&&t in ix)return Wu[n]=e[t];return n}var rx=pu("animationend"),sx=pu("animationiteration"),ox=pu("animationstart"),ax=pu("transitionend"),lx=new Map,km="abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");function $r(n,e){lx.set(n,e),Ls(e,[n])}for(var ju=0;ju<km.length;ju++){var Xu=km[ju],JS=Xu.toLowerCase(),QS=Xu[0].toUpperCase()+Xu.slice(1);$r(JS,"on"+QS)}$r(rx,"onAnimationEnd");$r(sx,"onAnimationIteration");$r(ox,"onAnimationStart");$r("dblclick","onDoubleClick");$r("focusin","onFocus");$r("focusout","onBlur");$r(ax,"onTransitionEnd");To("onMouseEnter",["mouseout","mouseover"]);To("onMouseLeave",["mouseout","mouseover"]);To("onPointerEnter",["pointerout","pointerover"]);To("onPointerLeave",["pointerout","pointerover"]);Ls("onChange","change click focusin focusout input keydown keyup selectionchange".split(" "));Ls("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));Ls("onBeforeInput",["compositionend","keypress","textInput","paste"]);Ls("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" "));Ls("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" "));Ls("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var ba="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),eM=new Set("cancel close invalid load scroll toggle".split(" ").concat(ba));function Om(n,e,t){var i=n.type||"unknown-event";n.currentTarget=t,Jy(i,e,void 0,n),n.currentTarget=null}function cx(n,e){e=(e&4)!==0;for(var t=0;t<n.length;t++){var i=n[t],r=i.event;i=i.listeners;e:{var s=void 0;if(e)for(var o=i.length-1;0<=o;o--){var a=i[o],l=a.instance,c=a.currentTarget;if(a=a.listener,l!==s&&r.isPropagationStopped())break e;Om(r,a,c),s=l}else for(o=0;o<i.length;o++){if(a=i[o],l=a.instance,c=a.currentTarget,a=a.listener,l!==s&&r.isPropagationStopped())break e;Om(r,a,c),s=l}}}if(Dc)throw n=df,Dc=!1,df=null,n}function Lt(n,e){var t=e[Sf];t===void 0&&(t=e[Sf]=new Set);var i=n+"__bubble";t.has(i)||(ux(e,n,2,!1),t.add(i))}function Yu(n,e,t){var i=0;e&&(i|=4),ux(t,n,i,e)}var Rl="_reactListening"+Math.random().toString(36).slice(2);function qa(n){if(!n[Rl]){n[Rl]=!0,__.forEach(function(t){t!=="selectionchange"&&(eM.has(t)||Yu(t,!1,n),Yu(t,!0,n))});var e=n.nodeType===9?n:n.ownerDocument;e===null||e[Rl]||(e[Rl]=!0,Yu("selectionchange",!1,e))}}function ux(n,e,t,i){switch(Y_(e)){case 1:var r=pS;break;case 4:r=mS;break;default:r=qh}t=r.bind(null,e,t,n),r=void 0,!uf||e!=="touchstart"&&e!=="touchmove"&&e!=="wheel"||(r=!0),i?r!==void 0?n.addEventListener(e,t,{capture:!0,passive:r}):n.addEventListener(e,t,!0):r!==void 0?n.addEventListener(e,t,{passive:r}):n.addEventListener(e,t,!1)}function Ku(n,e,t,i,r){var s=i;if(!(e&1)&&!(e&2)&&i!==null)e:for(;;){if(i===null)return;var o=i.tag;if(o===3||o===4){var a=i.stateNode.containerInfo;if(a===r||a.nodeType===8&&a.parentNode===r)break;if(o===4)for(o=i.return;o!==null;){var l=o.tag;if((l===3||l===4)&&(l=o.stateNode.containerInfo,l===r||l.nodeType===8&&l.parentNode===r))return;o=o.return}for(;a!==null;){if(o=xs(a),o===null)return;if(l=o.tag,l===5||l===6){i=s=o;continue e}a=a.parentNode}}i=i.return}D_(function(){var c=s,u=jh(t),d=[];e:{var f=lx.get(n);if(f!==void 0){var p=Zh,g=n;switch(n){case"keypress":if(mc(t)===0)break e;case"keydown":case"keyup":p=PS;break;case"focusin":g="focus",p=Hu;break;case"focusout":g="blur",p=Hu;break;case"beforeblur":case"afterblur":p=Hu;break;case"click":if(t.button===2)break e;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":p=Tm;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":p=xS;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":p=DS;break;case rx:case sx:case ox:p=SS;break;case ax:p=US;break;case"scroll":p=gS;break;case"wheel":p=OS;break;case"copy":case"cut":case"paste":p=ES;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":p=Am}var v=(e&4)!==0,m=!v&&n==="scroll",h=v?f!==null?f+"Capture":null:f;v=[];for(var _=c,x;_!==null;){x=_;var M=x.stateNode;if(x.tag===5&&M!==null&&(x=M,h!==null&&(M=Ga(_,h),M!=null&&v.push($a(_,M,x)))),m)break;_=_.return}0<v.length&&(f=new p(f,g,null,t,u),d.push({event:f,listeners:v}))}}if(!(e&7)){e:{if(f=n==="mouseover"||n==="pointerover",p=n==="mouseout"||n==="pointerout",f&&t!==lf&&(g=t.relatedTarget||t.fromElement)&&(xs(g)||g[hr]))break e;if((p||f)&&(f=u.window===u?u:(f=u.ownerDocument)?f.defaultView||f.parentWindow:window,p?(g=t.relatedTarget||t.toElement,p=c,g=g?xs(g):null,g!==null&&(m=Ns(g),g!==m||g.tag!==5&&g.tag!==6)&&(g=null)):(p=null,g=c),p!==g)){if(v=Tm,M="onMouseLeave",h="onMouseEnter",_="mouse",(n==="pointerout"||n==="pointerover")&&(v=Am,M="onPointerLeave",h="onPointerEnter",_="pointer"),m=p==null?f:ro(p),x=g==null?f:ro(g),f=new v(M,_+"leave",p,t,u),f.target=m,f.relatedTarget=x,M=null,xs(u)===c&&(v=new v(h,_+"enter",g,t,u),v.target=x,v.relatedTarget=m,M=v),m=M,p&&g)t:{for(v=p,h=g,_=0,x=v;x;x=Os(x))_++;for(x=0,M=h;M;M=Os(M))x++;for(;0<_-x;)v=Os(v),_--;for(;0<x-_;)h=Os(h),x--;for(;_--;){if(v===h||h!==null&&v===h.alternate)break t;v=Os(v),h=Os(h)}v=null}else v=null;p!==null&&Fm(d,f,p,v,!1),g!==null&&m!==null&&Fm(d,m,g,v,!0)}}e:{if(f=c?ro(c):window,p=f.nodeName&&f.nodeName.toLowerCase(),p==="select"||p==="input"&&f.type==="file")var L=WS;else if(Pm(f))if(Q_)L=KS;else{L=XS;var A=jS}else(p=f.nodeName)&&p.toLowerCase()==="input"&&(f.type==="checkbox"||f.type==="radio")&&(L=YS);if(L&&(L=L(n,c))){J_(d,L,t,u);break e}A&&A(n,f,c),n==="focusout"&&(A=f._wrapperState)&&A.controlled&&f.type==="number"&&nf(f,"number",f.value)}switch(A=c?ro(c):window,n){case"focusin":(Pm(A)||A.contentEditable==="true")&&(no=A,mf=c,Da=null);break;case"focusout":Da=mf=no=null;break;case"mousedown":gf=!0;break;case"contextmenu":case"mouseup":case"dragend":gf=!1,Um(d,t,u);break;case"selectionchange":if(ZS)break;case"keydown":case"keyup":Um(d,t,u)}var T;if(Qh)e:{switch(n){case"compositionstart":var I="onCompositionStart";break e;case"compositionend":I="onCompositionEnd";break e;case"compositionupdate":I="onCompositionUpdate";break e}I=void 0}else to?$_(n,t)&&(I="onCompositionEnd"):n==="keydown"&&t.keyCode===229&&(I="onCompositionStart");I&&(q_&&t.locale!=="ko"&&(to||I!=="onCompositionStart"?I==="onCompositionEnd"&&to&&(T=K_()):(Ir=u,$h="value"in Ir?Ir.value:Ir.textContent,to=!0)),A=Fc(c,I),0<A.length&&(I=new bm(I,n,null,t,u),d.push({event:I,listeners:A}),T?I.data=T:(T=Z_(t),T!==null&&(I.data=T)))),(T=BS?zS(n,t):HS(n,t))&&(c=Fc(c,"onBeforeInput"),0<c.length&&(u=new bm("onBeforeInput","beforeinput",null,t,u),d.push({event:u,listeners:c}),u.data=T))}cx(d,e)})}function $a(n,e,t){return{instance:n,listener:e,currentTarget:t}}function Fc(n,e){for(var t=e+"Capture",i=[];n!==null;){var r=n,s=r.stateNode;r.tag===5&&s!==null&&(r=s,s=Ga(n,t),s!=null&&i.unshift($a(n,s,r)),s=Ga(n,e),s!=null&&i.push($a(n,s,r))),n=n.return}return i}function Os(n){if(n===null)return null;do n=n.return;while(n&&n.tag!==5);return n||null}function Fm(n,e,t,i,r){for(var s=e._reactName,o=[];t!==null&&t!==i;){var a=t,l=a.alternate,c=a.stateNode;if(l!==null&&l===i)break;a.tag===5&&c!==null&&(a=c,r?(l=Ga(t,s),l!=null&&o.unshift($a(t,l,a))):r||(l=Ga(t,s),l!=null&&o.push($a(t,l,a)))),t=t.return}o.length!==0&&n.push({event:e,listeners:o})}var tM=/\r\n?/g,nM=/\u0000|\uFFFD/g;function Bm(n){return(typeof n=="string"?n:""+n).replace(tM,`
`).replace(nM,"")}function Cl(n,e,t){if(e=Bm(e),Bm(n)!==e&&t)throw Error(le(425))}function Bc(){}var _f=null,xf=null;function vf(n,e){return n==="textarea"||n==="noscript"||typeof e.children=="string"||typeof e.children=="number"||typeof e.dangerouslySetInnerHTML=="object"&&e.dangerouslySetInnerHTML!==null&&e.dangerouslySetInnerHTML.__html!=null}var yf=typeof setTimeout=="function"?setTimeout:void 0,iM=typeof clearTimeout=="function"?clearTimeout:void 0,zm=typeof Promise=="function"?Promise:void 0,rM=typeof queueMicrotask=="function"?queueMicrotask:typeof zm<"u"?function(n){return zm.resolve(null).then(n).catch(sM)}:yf;function sM(n){setTimeout(function(){throw n})}function qu(n,e){var t=e,i=0;do{var r=t.nextSibling;if(n.removeChild(t),r&&r.nodeType===8)if(t=r.data,t==="/$"){if(i===0){n.removeChild(r),Xa(e);return}i--}else t!=="$"&&t!=="$?"&&t!=="$!"||i++;t=r}while(t);Xa(e)}function Hr(n){for(;n!=null;n=n.nextSibling){var e=n.nodeType;if(e===1||e===3)break;if(e===8){if(e=n.data,e==="$"||e==="$!"||e==="$?")break;if(e==="/$")return null}}return n}function Hm(n){n=n.previousSibling;for(var e=0;n;){if(n.nodeType===8){var t=n.data;if(t==="$"||t==="$!"||t==="$?"){if(e===0)return n;e--}else t==="/$"&&e++}n=n.previousSibling}return null}var jo=Math.random().toString(36).slice(2),Ui="__reactFiber$"+jo,Za="__reactProps$"+jo,hr="__reactContainer$"+jo,Sf="__reactEvents$"+jo,oM="__reactListeners$"+jo,aM="__reactHandles$"+jo;function xs(n){var e=n[Ui];if(e)return e;for(var t=n.parentNode;t;){if(e=t[hr]||t[Ui]){if(t=e.alternate,e.child!==null||t!==null&&t.child!==null)for(n=Hm(n);n!==null;){if(t=n[Ui])return t;n=Hm(n)}return e}n=t,t=n.parentNode}return null}function dl(n){return n=n[Ui]||n[hr],!n||n.tag!==5&&n.tag!==6&&n.tag!==13&&n.tag!==3?null:n}function ro(n){if(n.tag===5||n.tag===6)return n.stateNode;throw Error(le(33))}function mu(n){return n[Za]||null}var Mf=[],so=-1;function Zr(n){return{current:n}}function Dt(n){0>so||(n.current=Mf[so],Mf[so]=null,so--)}function Ct(n,e){so++,Mf[so]=n.current,n.current=e}var Kr={},Sn=Zr(Kr),Fn=Zr(!1),ws=Kr;function bo(n,e){var t=n.type.contextTypes;if(!t)return Kr;var i=n.stateNode;if(i&&i.__reactInternalMemoizedUnmaskedChildContext===e)return i.__reactInternalMemoizedMaskedChildContext;var r={},s;for(s in t)r[s]=e[s];return i&&(n=n.stateNode,n.__reactInternalMemoizedUnmaskedChildContext=e,n.__reactInternalMemoizedMaskedChildContext=r),r}function Bn(n){return n=n.childContextTypes,n!=null}function zc(){Dt(Fn),Dt(Sn)}function Vm(n,e,t){if(Sn.current!==Kr)throw Error(le(168));Ct(Sn,e),Ct(Fn,t)}function dx(n,e,t){var i=n.stateNode;if(e=e.childContextTypes,typeof i.getChildContext!="function")return t;i=i.getChildContext();for(var r in i)if(!(r in e))throw Error(le(108,jy(n)||"Unknown",r));return zt({},t,i)}function Hc(n){return n=(n=n.stateNode)&&n.__reactInternalMemoizedMergedChildContext||Kr,ws=Sn.current,Ct(Sn,n),Ct(Fn,Fn.current),!0}function Gm(n,e,t){var i=n.stateNode;if(!i)throw Error(le(169));t?(n=dx(n,e,ws),i.__reactInternalMemoizedMergedChildContext=n,Dt(Fn),Dt(Sn),Ct(Sn,n)):Dt(Fn),Ct(Fn,t)}var ir=null,gu=!1,$u=!1;function fx(n){ir===null?ir=[n]:ir.push(n)}function lM(n){gu=!0,fx(n)}function Jr(){if(!$u&&ir!==null){$u=!0;var n=0,e=wt;try{var t=ir;for(wt=1;n<t.length;n++){var i=t[n];do i=i(!0);while(i!==null)}ir=null,gu=!1}catch(r){throw ir!==null&&(ir=ir.slice(n+1)),O_(Xh,Jr),r}finally{wt=e,$u=!1}}return null}var oo=[],ao=0,Vc=null,Gc=0,ii=[],ri=0,Ts=null,or=1,ar="";function hs(n,e){oo[ao++]=Gc,oo[ao++]=Vc,Vc=n,Gc=e}function hx(n,e,t){ii[ri++]=or,ii[ri++]=ar,ii[ri++]=Ts,Ts=n;var i=or;n=ar;var r=32-Ei(i)-1;i&=~(1<<r),t+=1;var s=32-Ei(e)+r;if(30<s){var o=r-r%5;s=(i&(1<<o)-1).toString(32),i>>=o,r-=o,or=1<<32-Ei(e)+r|t<<r|i,ar=s+n}else or=1<<s|t<<r|i,ar=n}function tp(n){n.return!==null&&(hs(n,1),hx(n,1,0))}function np(n){for(;n===Vc;)Vc=oo[--ao],oo[ao]=null,Gc=oo[--ao],oo[ao]=null;for(;n===Ts;)Ts=ii[--ri],ii[ri]=null,ar=ii[--ri],ii[ri]=null,or=ii[--ri],ii[ri]=null}var Kn=null,Xn=null,Ut=!1,vi=null;function px(n,e){var t=oi(5,null,null,0);t.elementType="DELETED",t.stateNode=e,t.return=n,e=n.deletions,e===null?(n.deletions=[t],n.flags|=16):e.push(t)}function Wm(n,e){switch(n.tag){case 5:var t=n.type;return e=e.nodeType!==1||t.toLowerCase()!==e.nodeName.toLowerCase()?null:e,e!==null?(n.stateNode=e,Kn=n,Xn=Hr(e.firstChild),!0):!1;case 6:return e=n.pendingProps===""||e.nodeType!==3?null:e,e!==null?(n.stateNode=e,Kn=n,Xn=null,!0):!1;case 13:return e=e.nodeType!==8?null:e,e!==null?(t=Ts!==null?{id:or,overflow:ar}:null,n.memoizedState={dehydrated:e,treeContext:t,retryLane:1073741824},t=oi(18,null,null,0),t.stateNode=e,t.return=n,n.child=t,Kn=n,Xn=null,!0):!1;default:return!1}}function Ef(n){return(n.mode&1)!==0&&(n.flags&128)===0}function wf(n){if(Ut){var e=Xn;if(e){var t=e;if(!Wm(n,e)){if(Ef(n))throw Error(le(418));e=Hr(t.nextSibling);var i=Kn;e&&Wm(n,e)?px(i,t):(n.flags=n.flags&-4097|2,Ut=!1,Kn=n)}}else{if(Ef(n))throw Error(le(418));n.flags=n.flags&-4097|2,Ut=!1,Kn=n}}}function jm(n){for(n=n.return;n!==null&&n.tag!==5&&n.tag!==3&&n.tag!==13;)n=n.return;Kn=n}function Pl(n){if(n!==Kn)return!1;if(!Ut)return jm(n),Ut=!0,!1;var e;if((e=n.tag!==3)&&!(e=n.tag!==5)&&(e=n.type,e=e!=="head"&&e!=="body"&&!vf(n.type,n.memoizedProps)),e&&(e=Xn)){if(Ef(n))throw mx(),Error(le(418));for(;e;)px(n,e),e=Hr(e.nextSibling)}if(jm(n),n.tag===13){if(n=n.memoizedState,n=n!==null?n.dehydrated:null,!n)throw Error(le(317));e:{for(n=n.nextSibling,e=0;n;){if(n.nodeType===8){var t=n.data;if(t==="/$"){if(e===0){Xn=Hr(n.nextSibling);break e}e--}else t!=="$"&&t!=="$!"&&t!=="$?"||e++}n=n.nextSibling}Xn=null}}else Xn=Kn?Hr(n.stateNode.nextSibling):null;return!0}function mx(){for(var n=Xn;n;)n=Hr(n.nextSibling)}function Ao(){Xn=Kn=null,Ut=!1}function ip(n){vi===null?vi=[n]:vi.push(n)}var cM=_r.ReactCurrentBatchConfig;function aa(n,e,t){if(n=t.ref,n!==null&&typeof n!="function"&&typeof n!="object"){if(t._owner){if(t=t._owner,t){if(t.tag!==1)throw Error(le(309));var i=t.stateNode}if(!i)throw Error(le(147,n));var r=i,s=""+n;return e!==null&&e.ref!==null&&typeof e.ref=="function"&&e.ref._stringRef===s?e.ref:(e=function(o){var a=r.refs;o===null?delete a[s]:a[s]=o},e._stringRef=s,e)}if(typeof n!="string")throw Error(le(284));if(!t._owner)throw Error(le(290,n))}return n}function Ll(n,e){throw n=Object.prototype.toString.call(e),Error(le(31,n==="[object Object]"?"object with keys {"+Object.keys(e).join(", ")+"}":n))}function Xm(n){var e=n._init;return e(n._payload)}function gx(n){function e(h,_){if(n){var x=h.deletions;x===null?(h.deletions=[_],h.flags|=16):x.push(_)}}function t(h,_){if(!n)return null;for(;_!==null;)e(h,_),_=_.sibling;return null}function i(h,_){for(h=new Map;_!==null;)_.key!==null?h.set(_.key,_):h.set(_.index,_),_=_.sibling;return h}function r(h,_){return h=jr(h,_),h.index=0,h.sibling=null,h}function s(h,_,x){return h.index=x,n?(x=h.alternate,x!==null?(x=x.index,x<_?(h.flags|=2,_):x):(h.flags|=2,_)):(h.flags|=1048576,_)}function o(h){return n&&h.alternate===null&&(h.flags|=2),h}function a(h,_,x,M){return _===null||_.tag!==6?(_=id(x,h.mode,M),_.return=h,_):(_=r(_,x),_.return=h,_)}function l(h,_,x,M){var L=x.type;return L===eo?u(h,_,x.props.children,M,x.key):_!==null&&(_.elementType===L||typeof L=="object"&&L!==null&&L.$$typeof===Cr&&Xm(L)===_.type)?(M=r(_,x.props),M.ref=aa(h,_,x),M.return=h,M):(M=Mc(x.type,x.key,x.props,null,h.mode,M),M.ref=aa(h,_,x),M.return=h,M)}function c(h,_,x,M){return _===null||_.tag!==4||_.stateNode.containerInfo!==x.containerInfo||_.stateNode.implementation!==x.implementation?(_=rd(x,h.mode,M),_.return=h,_):(_=r(_,x.children||[]),_.return=h,_)}function u(h,_,x,M,L){return _===null||_.tag!==7?(_=Es(x,h.mode,M,L),_.return=h,_):(_=r(_,x),_.return=h,_)}function d(h,_,x){if(typeof _=="string"&&_!==""||typeof _=="number")return _=id(""+_,h.mode,x),_.return=h,_;if(typeof _=="object"&&_!==null){switch(_.$$typeof){case yl:return x=Mc(_.type,_.key,_.props,null,h.mode,x),x.ref=aa(h,null,_),x.return=h,x;case Qs:return _=rd(_,h.mode,x),_.return=h,_;case Cr:var M=_._init;return d(h,M(_._payload),x)}if(wa(_)||na(_))return _=Es(_,h.mode,x,null),_.return=h,_;Ll(h,_)}return null}function f(h,_,x,M){var L=_!==null?_.key:null;if(typeof x=="string"&&x!==""||typeof x=="number")return L!==null?null:a(h,_,""+x,M);if(typeof x=="object"&&x!==null){switch(x.$$typeof){case yl:return x.key===L?l(h,_,x,M):null;case Qs:return x.key===L?c(h,_,x,M):null;case Cr:return L=x._init,f(h,_,L(x._payload),M)}if(wa(x)||na(x))return L!==null?null:u(h,_,x,M,null);Ll(h,x)}return null}function p(h,_,x,M,L){if(typeof M=="string"&&M!==""||typeof M=="number")return h=h.get(x)||null,a(_,h,""+M,L);if(typeof M=="object"&&M!==null){switch(M.$$typeof){case yl:return h=h.get(M.key===null?x:M.key)||null,l(_,h,M,L);case Qs:return h=h.get(M.key===null?x:M.key)||null,c(_,h,M,L);case Cr:var A=M._init;return p(h,_,x,A(M._payload),L)}if(wa(M)||na(M))return h=h.get(x)||null,u(_,h,M,L,null);Ll(_,M)}return null}function g(h,_,x,M){for(var L=null,A=null,T=_,I=_=0,K=null;T!==null&&I<x.length;I++){T.index>I?(K=T,T=null):K=T.sibling;var y=f(h,T,x[I],M);if(y===null){T===null&&(T=K);break}n&&T&&y.alternate===null&&e(h,T),_=s(y,_,I),A===null?L=y:A.sibling=y,A=y,T=K}if(I===x.length)return t(h,T),Ut&&hs(h,I),L;if(T===null){for(;I<x.length;I++)T=d(h,x[I],M),T!==null&&(_=s(T,_,I),A===null?L=T:A.sibling=T,A=T);return Ut&&hs(h,I),L}for(T=i(h,T);I<x.length;I++)K=p(T,h,I,x[I],M),K!==null&&(n&&K.alternate!==null&&T.delete(K.key===null?I:K.key),_=s(K,_,I),A===null?L=K:A.sibling=K,A=K);return n&&T.forEach(function(w){return e(h,w)}),Ut&&hs(h,I),L}function v(h,_,x,M){var L=na(x);if(typeof L!="function")throw Error(le(150));if(x=L.call(x),x==null)throw Error(le(151));for(var A=L=null,T=_,I=_=0,K=null,y=x.next();T!==null&&!y.done;I++,y=x.next()){T.index>I?(K=T,T=null):K=T.sibling;var w=f(h,T,y.value,M);if(w===null){T===null&&(T=K);break}n&&T&&w.alternate===null&&e(h,T),_=s(w,_,I),A===null?L=w:A.sibling=w,A=w,T=K}if(y.done)return t(h,T),Ut&&hs(h,I),L;if(T===null){for(;!y.done;I++,y=x.next())y=d(h,y.value,M),y!==null&&(_=s(y,_,I),A===null?L=y:A.sibling=y,A=y);return Ut&&hs(h,I),L}for(T=i(h,T);!y.done;I++,y=x.next())y=p(T,h,I,y.value,M),y!==null&&(n&&y.alternate!==null&&T.delete(y.key===null?I:y.key),_=s(y,_,I),A===null?L=y:A.sibling=y,A=y);return n&&T.forEach(function(X){return e(h,X)}),Ut&&hs(h,I),L}function m(h,_,x,M){if(typeof x=="object"&&x!==null&&x.type===eo&&x.key===null&&(x=x.props.children),typeof x=="object"&&x!==null){switch(x.$$typeof){case yl:e:{for(var L=x.key,A=_;A!==null;){if(A.key===L){if(L=x.type,L===eo){if(A.tag===7){t(h,A.sibling),_=r(A,x.props.children),_.return=h,h=_;break e}}else if(A.elementType===L||typeof L=="object"&&L!==null&&L.$$typeof===Cr&&Xm(L)===A.type){t(h,A.sibling),_=r(A,x.props),_.ref=aa(h,A,x),_.return=h,h=_;break e}t(h,A);break}else e(h,A);A=A.sibling}x.type===eo?(_=Es(x.props.children,h.mode,M,x.key),_.return=h,h=_):(M=Mc(x.type,x.key,x.props,null,h.mode,M),M.ref=aa(h,_,x),M.return=h,h=M)}return o(h);case Qs:e:{for(A=x.key;_!==null;){if(_.key===A)if(_.tag===4&&_.stateNode.containerInfo===x.containerInfo&&_.stateNode.implementation===x.implementation){t(h,_.sibling),_=r(_,x.children||[]),_.return=h,h=_;break e}else{t(h,_);break}else e(h,_);_=_.sibling}_=rd(x,h.mode,M),_.return=h,h=_}return o(h);case Cr:return A=x._init,m(h,_,A(x._payload),M)}if(wa(x))return g(h,_,x,M);if(na(x))return v(h,_,x,M);Ll(h,x)}return typeof x=="string"&&x!==""||typeof x=="number"?(x=""+x,_!==null&&_.tag===6?(t(h,_.sibling),_=r(_,x),_.return=h,h=_):(t(h,_),_=id(x,h.mode,M),_.return=h,h=_),o(h)):t(h,_)}return m}var Ro=gx(!0),_x=gx(!1),Wc=Zr(null),jc=null,lo=null,rp=null;function sp(){rp=lo=jc=null}function op(n){var e=Wc.current;Dt(Wc),n._currentValue=e}function Tf(n,e,t){for(;n!==null;){var i=n.alternate;if((n.childLanes&e)!==e?(n.childLanes|=e,i!==null&&(i.childLanes|=e)):i!==null&&(i.childLanes&e)!==e&&(i.childLanes|=e),n===t)break;n=n.return}}function xo(n,e){jc=n,rp=lo=null,n=n.dependencies,n!==null&&n.firstContext!==null&&(n.lanes&e&&(On=!0),n.firstContext=null)}function ci(n){var e=n._currentValue;if(rp!==n)if(n={context:n,memoizedValue:e,next:null},lo===null){if(jc===null)throw Error(le(308));lo=n,jc.dependencies={lanes:0,firstContext:n}}else lo=lo.next=n;return e}var vs=null;function ap(n){vs===null?vs=[n]:vs.push(n)}function xx(n,e,t,i){var r=e.interleaved;return r===null?(t.next=t,ap(e)):(t.next=r.next,r.next=t),e.interleaved=t,pr(n,i)}function pr(n,e){n.lanes|=e;var t=n.alternate;for(t!==null&&(t.lanes|=e),t=n,n=n.return;n!==null;)n.childLanes|=e,t=n.alternate,t!==null&&(t.childLanes|=e),t=n,n=n.return;return t.tag===3?t.stateNode:null}var Pr=!1;function lp(n){n.updateQueue={baseState:n.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,interleaved:null,lanes:0},effects:null}}function vx(n,e){n=n.updateQueue,e.updateQueue===n&&(e.updateQueue={baseState:n.baseState,firstBaseUpdate:n.firstBaseUpdate,lastBaseUpdate:n.lastBaseUpdate,shared:n.shared,effects:n.effects})}function ur(n,e){return{eventTime:n,lane:e,tag:0,payload:null,callback:null,next:null}}function Vr(n,e,t){var i=n.updateQueue;if(i===null)return null;if(i=i.shared,gt&2){var r=i.pending;return r===null?e.next=e:(e.next=r.next,r.next=e),i.pending=e,pr(n,t)}return r=i.interleaved,r===null?(e.next=e,ap(i)):(e.next=r.next,r.next=e),i.interleaved=e,pr(n,t)}function gc(n,e,t){if(e=e.updateQueue,e!==null&&(e=e.shared,(t&4194240)!==0)){var i=e.lanes;i&=n.pendingLanes,t|=i,e.lanes=t,Yh(n,t)}}function Ym(n,e){var t=n.updateQueue,i=n.alternate;if(i!==null&&(i=i.updateQueue,t===i)){var r=null,s=null;if(t=t.firstBaseUpdate,t!==null){do{var o={eventTime:t.eventTime,lane:t.lane,tag:t.tag,payload:t.payload,callback:t.callback,next:null};s===null?r=s=o:s=s.next=o,t=t.next}while(t!==null);s===null?r=s=e:s=s.next=e}else r=s=e;t={baseState:i.baseState,firstBaseUpdate:r,lastBaseUpdate:s,shared:i.shared,effects:i.effects},n.updateQueue=t;return}n=t.lastBaseUpdate,n===null?t.firstBaseUpdate=e:n.next=e,t.lastBaseUpdate=e}function Xc(n,e,t,i){var r=n.updateQueue;Pr=!1;var s=r.firstBaseUpdate,o=r.lastBaseUpdate,a=r.shared.pending;if(a!==null){r.shared.pending=null;var l=a,c=l.next;l.next=null,o===null?s=c:o.next=c,o=l;var u=n.alternate;u!==null&&(u=u.updateQueue,a=u.lastBaseUpdate,a!==o&&(a===null?u.firstBaseUpdate=c:a.next=c,u.lastBaseUpdate=l))}if(s!==null){var d=r.baseState;o=0,u=c=l=null,a=s;do{var f=a.lane,p=a.eventTime;if((i&f)===f){u!==null&&(u=u.next={eventTime:p,lane:0,tag:a.tag,payload:a.payload,callback:a.callback,next:null});e:{var g=n,v=a;switch(f=e,p=t,v.tag){case 1:if(g=v.payload,typeof g=="function"){d=g.call(p,d,f);break e}d=g;break e;case 3:g.flags=g.flags&-65537|128;case 0:if(g=v.payload,f=typeof g=="function"?g.call(p,d,f):g,f==null)break e;d=zt({},d,f);break e;case 2:Pr=!0}}a.callback!==null&&a.lane!==0&&(n.flags|=64,f=r.effects,f===null?r.effects=[a]:f.push(a))}else p={eventTime:p,lane:f,tag:a.tag,payload:a.payload,callback:a.callback,next:null},u===null?(c=u=p,l=d):u=u.next=p,o|=f;if(a=a.next,a===null){if(a=r.shared.pending,a===null)break;f=a,a=f.next,f.next=null,r.lastBaseUpdate=f,r.shared.pending=null}}while(!0);if(u===null&&(l=d),r.baseState=l,r.firstBaseUpdate=c,r.lastBaseUpdate=u,e=r.shared.interleaved,e!==null){r=e;do o|=r.lane,r=r.next;while(r!==e)}else s===null&&(r.shared.lanes=0);As|=o,n.lanes=o,n.memoizedState=d}}function Km(n,e,t){if(n=e.effects,e.effects=null,n!==null)for(e=0;e<n.length;e++){var i=n[e],r=i.callback;if(r!==null){if(i.callback=null,i=t,typeof r!="function")throw Error(le(191,r));r.call(i)}}}var fl={},Bi=Zr(fl),Ja=Zr(fl),Qa=Zr(fl);function ys(n){if(n===fl)throw Error(le(174));return n}function cp(n,e){switch(Ct(Qa,e),Ct(Ja,n),Ct(Bi,fl),n=e.nodeType,n){case 9:case 11:e=(e=e.documentElement)?e.namespaceURI:sf(null,"");break;default:n=n===8?e.parentNode:e,e=n.namespaceURI||null,n=n.tagName,e=sf(e,n)}Dt(Bi),Ct(Bi,e)}function Co(){Dt(Bi),Dt(Ja),Dt(Qa)}function yx(n){ys(Qa.current);var e=ys(Bi.current),t=sf(e,n.type);e!==t&&(Ct(Ja,n),Ct(Bi,t))}function up(n){Ja.current===n&&(Dt(Bi),Dt(Ja))}var Ot=Zr(0);function Yc(n){for(var e=n;e!==null;){if(e.tag===13){var t=e.memoizedState;if(t!==null&&(t=t.dehydrated,t===null||t.data==="$?"||t.data==="$!"))return e}else if(e.tag===19&&e.memoizedProps.revealOrder!==void 0){if(e.flags&128)return e}else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===n)break;for(;e.sibling===null;){if(e.return===null||e.return===n)return null;e=e.return}e.sibling.return=e.return,e=e.sibling}return null}var Zu=[];function dp(){for(var n=0;n<Zu.length;n++)Zu[n]._workInProgressVersionPrimary=null;Zu.length=0}var _c=_r.ReactCurrentDispatcher,Ju=_r.ReactCurrentBatchConfig,bs=0,Ft=null,Zt=null,rn=null,Kc=!1,Ia=!1,el=0,uM=0;function gn(){throw Error(le(321))}function fp(n,e){if(e===null)return!1;for(var t=0;t<e.length&&t<n.length;t++)if(!Ai(n[t],e[t]))return!1;return!0}function hp(n,e,t,i,r,s){if(bs=s,Ft=e,e.memoizedState=null,e.updateQueue=null,e.lanes=0,_c.current=n===null||n.memoizedState===null?pM:mM,n=t(i,r),Ia){s=0;do{if(Ia=!1,el=0,25<=s)throw Error(le(301));s+=1,rn=Zt=null,e.updateQueue=null,_c.current=gM,n=t(i,r)}while(Ia)}if(_c.current=qc,e=Zt!==null&&Zt.next!==null,bs=0,rn=Zt=Ft=null,Kc=!1,e)throw Error(le(300));return n}function pp(){var n=el!==0;return el=0,n}function Di(){var n={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return rn===null?Ft.memoizedState=rn=n:rn=rn.next=n,rn}function ui(){if(Zt===null){var n=Ft.alternate;n=n!==null?n.memoizedState:null}else n=Zt.next;var e=rn===null?Ft.memoizedState:rn.next;if(e!==null)rn=e,Zt=n;else{if(n===null)throw Error(le(310));Zt=n,n={memoizedState:Zt.memoizedState,baseState:Zt.baseState,baseQueue:Zt.baseQueue,queue:Zt.queue,next:null},rn===null?Ft.memoizedState=rn=n:rn=rn.next=n}return rn}function tl(n,e){return typeof e=="function"?e(n):e}function Qu(n){var e=ui(),t=e.queue;if(t===null)throw Error(le(311));t.lastRenderedReducer=n;var i=Zt,r=i.baseQueue,s=t.pending;if(s!==null){if(r!==null){var o=r.next;r.next=s.next,s.next=o}i.baseQueue=r=s,t.pending=null}if(r!==null){s=r.next,i=i.baseState;var a=o=null,l=null,c=s;do{var u=c.lane;if((bs&u)===u)l!==null&&(l=l.next={lane:0,action:c.action,hasEagerState:c.hasEagerState,eagerState:c.eagerState,next:null}),i=c.hasEagerState?c.eagerState:n(i,c.action);else{var d={lane:u,action:c.action,hasEagerState:c.hasEagerState,eagerState:c.eagerState,next:null};l===null?(a=l=d,o=i):l=l.next=d,Ft.lanes|=u,As|=u}c=c.next}while(c!==null&&c!==s);l===null?o=i:l.next=a,Ai(i,e.memoizedState)||(On=!0),e.memoizedState=i,e.baseState=o,e.baseQueue=l,t.lastRenderedState=i}if(n=t.interleaved,n!==null){r=n;do s=r.lane,Ft.lanes|=s,As|=s,r=r.next;while(r!==n)}else r===null&&(t.lanes=0);return[e.memoizedState,t.dispatch]}function ed(n){var e=ui(),t=e.queue;if(t===null)throw Error(le(311));t.lastRenderedReducer=n;var i=t.dispatch,r=t.pending,s=e.memoizedState;if(r!==null){t.pending=null;var o=r=r.next;do s=n(s,o.action),o=o.next;while(o!==r);Ai(s,e.memoizedState)||(On=!0),e.memoizedState=s,e.baseQueue===null&&(e.baseState=s),t.lastRenderedState=s}return[s,i]}function Sx(){}function Mx(n,e){var t=Ft,i=ui(),r=e(),s=!Ai(i.memoizedState,r);if(s&&(i.memoizedState=r,On=!0),i=i.queue,mp(Tx.bind(null,t,i,n),[n]),i.getSnapshot!==e||s||rn!==null&&rn.memoizedState.tag&1){if(t.flags|=2048,nl(9,wx.bind(null,t,i,r,e),void 0,null),sn===null)throw Error(le(349));bs&30||Ex(t,e,r)}return r}function Ex(n,e,t){n.flags|=16384,n={getSnapshot:e,value:t},e=Ft.updateQueue,e===null?(e={lastEffect:null,stores:null},Ft.updateQueue=e,e.stores=[n]):(t=e.stores,t===null?e.stores=[n]:t.push(n))}function wx(n,e,t,i){e.value=t,e.getSnapshot=i,bx(e)&&Ax(n)}function Tx(n,e,t){return t(function(){bx(e)&&Ax(n)})}function bx(n){var e=n.getSnapshot;n=n.value;try{var t=e();return!Ai(n,t)}catch{return!0}}function Ax(n){var e=pr(n,1);e!==null&&wi(e,n,1,-1)}function qm(n){var e=Di();return typeof n=="function"&&(n=n()),e.memoizedState=e.baseState=n,n={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:tl,lastRenderedState:n},e.queue=n,n=n.dispatch=hM.bind(null,Ft,n),[e.memoizedState,n]}function nl(n,e,t,i){return n={tag:n,create:e,destroy:t,deps:i,next:null},e=Ft.updateQueue,e===null?(e={lastEffect:null,stores:null},Ft.updateQueue=e,e.lastEffect=n.next=n):(t=e.lastEffect,t===null?e.lastEffect=n.next=n:(i=t.next,t.next=n,n.next=i,e.lastEffect=n)),n}function Rx(){return ui().memoizedState}function xc(n,e,t,i){var r=Di();Ft.flags|=n,r.memoizedState=nl(1|e,t,void 0,i===void 0?null:i)}function _u(n,e,t,i){var r=ui();i=i===void 0?null:i;var s=void 0;if(Zt!==null){var o=Zt.memoizedState;if(s=o.destroy,i!==null&&fp(i,o.deps)){r.memoizedState=nl(e,t,s,i);return}}Ft.flags|=n,r.memoizedState=nl(1|e,t,s,i)}function $m(n,e){return xc(8390656,8,n,e)}function mp(n,e){return _u(2048,8,n,e)}function Cx(n,e){return _u(4,2,n,e)}function Px(n,e){return _u(4,4,n,e)}function Lx(n,e){if(typeof e=="function")return n=n(),e(n),function(){e(null)};if(e!=null)return n=n(),e.current=n,function(){e.current=null}}function Nx(n,e,t){return t=t!=null?t.concat([n]):null,_u(4,4,Lx.bind(null,e,n),t)}function gp(){}function Dx(n,e){var t=ui();e=e===void 0?null:e;var i=t.memoizedState;return i!==null&&e!==null&&fp(e,i[1])?i[0]:(t.memoizedState=[n,e],n)}function Ix(n,e){var t=ui();e=e===void 0?null:e;var i=t.memoizedState;return i!==null&&e!==null&&fp(e,i[1])?i[0]:(n=n(),t.memoizedState=[n,e],n)}function Ux(n,e,t){return bs&21?(Ai(t,e)||(t=z_(),Ft.lanes|=t,As|=t,n.baseState=!0),e):(n.baseState&&(n.baseState=!1,On=!0),n.memoizedState=t)}function dM(n,e){var t=wt;wt=t!==0&&4>t?t:4,n(!0);var i=Ju.transition;Ju.transition={};try{n(!1),e()}finally{wt=t,Ju.transition=i}}function kx(){return ui().memoizedState}function fM(n,e,t){var i=Wr(n);if(t={lane:i,action:t,hasEagerState:!1,eagerState:null,next:null},Ox(n))Fx(e,t);else if(t=xx(n,e,t,i),t!==null){var r=Rn();wi(t,n,i,r),Bx(t,e,i)}}function hM(n,e,t){var i=Wr(n),r={lane:i,action:t,hasEagerState:!1,eagerState:null,next:null};if(Ox(n))Fx(e,r);else{var s=n.alternate;if(n.lanes===0&&(s===null||s.lanes===0)&&(s=e.lastRenderedReducer,s!==null))try{var o=e.lastRenderedState,a=s(o,t);if(r.hasEagerState=!0,r.eagerState=a,Ai(a,o)){var l=e.interleaved;l===null?(r.next=r,ap(e)):(r.next=l.next,l.next=r),e.interleaved=r;return}}catch{}finally{}t=xx(n,e,r,i),t!==null&&(r=Rn(),wi(t,n,i,r),Bx(t,e,i))}}function Ox(n){var e=n.alternate;return n===Ft||e!==null&&e===Ft}function Fx(n,e){Ia=Kc=!0;var t=n.pending;t===null?e.next=e:(e.next=t.next,t.next=e),n.pending=e}function Bx(n,e,t){if(t&4194240){var i=e.lanes;i&=n.pendingLanes,t|=i,e.lanes=t,Yh(n,t)}}var qc={readContext:ci,useCallback:gn,useContext:gn,useEffect:gn,useImperativeHandle:gn,useInsertionEffect:gn,useLayoutEffect:gn,useMemo:gn,useReducer:gn,useRef:gn,useState:gn,useDebugValue:gn,useDeferredValue:gn,useTransition:gn,useMutableSource:gn,useSyncExternalStore:gn,useId:gn,unstable_isNewReconciler:!1},pM={readContext:ci,useCallback:function(n,e){return Di().memoizedState=[n,e===void 0?null:e],n},useContext:ci,useEffect:$m,useImperativeHandle:function(n,e,t){return t=t!=null?t.concat([n]):null,xc(4194308,4,Lx.bind(null,e,n),t)},useLayoutEffect:function(n,e){return xc(4194308,4,n,e)},useInsertionEffect:function(n,e){return xc(4,2,n,e)},useMemo:function(n,e){var t=Di();return e=e===void 0?null:e,n=n(),t.memoizedState=[n,e],n},useReducer:function(n,e,t){var i=Di();return e=t!==void 0?t(e):e,i.memoizedState=i.baseState=e,n={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:n,lastRenderedState:e},i.queue=n,n=n.dispatch=fM.bind(null,Ft,n),[i.memoizedState,n]},useRef:function(n){var e=Di();return n={current:n},e.memoizedState=n},useState:qm,useDebugValue:gp,useDeferredValue:function(n){return Di().memoizedState=n},useTransition:function(){var n=qm(!1),e=n[0];return n=dM.bind(null,n[1]),Di().memoizedState=n,[e,n]},useMutableSource:function(){},useSyncExternalStore:function(n,e,t){var i=Ft,r=Di();if(Ut){if(t===void 0)throw Error(le(407));t=t()}else{if(t=e(),sn===null)throw Error(le(349));bs&30||Ex(i,e,t)}r.memoizedState=t;var s={value:t,getSnapshot:e};return r.queue=s,$m(Tx.bind(null,i,s,n),[n]),i.flags|=2048,nl(9,wx.bind(null,i,s,t,e),void 0,null),t},useId:function(){var n=Di(),e=sn.identifierPrefix;if(Ut){var t=ar,i=or;t=(i&~(1<<32-Ei(i)-1)).toString(32)+t,e=":"+e+"R"+t,t=el++,0<t&&(e+="H"+t.toString(32)),e+=":"}else t=uM++,e=":"+e+"r"+t.toString(32)+":";return n.memoizedState=e},unstable_isNewReconciler:!1},mM={readContext:ci,useCallback:Dx,useContext:ci,useEffect:mp,useImperativeHandle:Nx,useInsertionEffect:Cx,useLayoutEffect:Px,useMemo:Ix,useReducer:Qu,useRef:Rx,useState:function(){return Qu(tl)},useDebugValue:gp,useDeferredValue:function(n){var e=ui();return Ux(e,Zt.memoizedState,n)},useTransition:function(){var n=Qu(tl)[0],e=ui().memoizedState;return[n,e]},useMutableSource:Sx,useSyncExternalStore:Mx,useId:kx,unstable_isNewReconciler:!1},gM={readContext:ci,useCallback:Dx,useContext:ci,useEffect:mp,useImperativeHandle:Nx,useInsertionEffect:Cx,useLayoutEffect:Px,useMemo:Ix,useReducer:ed,useRef:Rx,useState:function(){return ed(tl)},useDebugValue:gp,useDeferredValue:function(n){var e=ui();return Zt===null?e.memoizedState=n:Ux(e,Zt.memoizedState,n)},useTransition:function(){var n=ed(tl)[0],e=ui().memoizedState;return[n,e]},useMutableSource:Sx,useSyncExternalStore:Mx,useId:kx,unstable_isNewReconciler:!1};function _i(n,e){if(n&&n.defaultProps){e=zt({},e),n=n.defaultProps;for(var t in n)e[t]===void 0&&(e[t]=n[t]);return e}return e}function bf(n,e,t,i){e=n.memoizedState,t=t(i,e),t=t==null?e:zt({},e,t),n.memoizedState=t,n.lanes===0&&(n.updateQueue.baseState=t)}var xu={isMounted:function(n){return(n=n._reactInternals)?Ns(n)===n:!1},enqueueSetState:function(n,e,t){n=n._reactInternals;var i=Rn(),r=Wr(n),s=ur(i,r);s.payload=e,t!=null&&(s.callback=t),e=Vr(n,s,r),e!==null&&(wi(e,n,r,i),gc(e,n,r))},enqueueReplaceState:function(n,e,t){n=n._reactInternals;var i=Rn(),r=Wr(n),s=ur(i,r);s.tag=1,s.payload=e,t!=null&&(s.callback=t),e=Vr(n,s,r),e!==null&&(wi(e,n,r,i),gc(e,n,r))},enqueueForceUpdate:function(n,e){n=n._reactInternals;var t=Rn(),i=Wr(n),r=ur(t,i);r.tag=2,e!=null&&(r.callback=e),e=Vr(n,r,i),e!==null&&(wi(e,n,i,t),gc(e,n,i))}};function Zm(n,e,t,i,r,s,o){return n=n.stateNode,typeof n.shouldComponentUpdate=="function"?n.shouldComponentUpdate(i,s,o):e.prototype&&e.prototype.isPureReactComponent?!Ka(t,i)||!Ka(r,s):!0}function zx(n,e,t){var i=!1,r=Kr,s=e.contextType;return typeof s=="object"&&s!==null?s=ci(s):(r=Bn(e)?ws:Sn.current,i=e.contextTypes,s=(i=i!=null)?bo(n,r):Kr),e=new e(t,s),n.memoizedState=e.state!==null&&e.state!==void 0?e.state:null,e.updater=xu,n.stateNode=e,e._reactInternals=n,i&&(n=n.stateNode,n.__reactInternalMemoizedUnmaskedChildContext=r,n.__reactInternalMemoizedMaskedChildContext=s),e}function Jm(n,e,t,i){n=e.state,typeof e.componentWillReceiveProps=="function"&&e.componentWillReceiveProps(t,i),typeof e.UNSAFE_componentWillReceiveProps=="function"&&e.UNSAFE_componentWillReceiveProps(t,i),e.state!==n&&xu.enqueueReplaceState(e,e.state,null)}function Af(n,e,t,i){var r=n.stateNode;r.props=t,r.state=n.memoizedState,r.refs={},lp(n);var s=e.contextType;typeof s=="object"&&s!==null?r.context=ci(s):(s=Bn(e)?ws:Sn.current,r.context=bo(n,s)),r.state=n.memoizedState,s=e.getDerivedStateFromProps,typeof s=="function"&&(bf(n,e,s,t),r.state=n.memoizedState),typeof e.getDerivedStateFromProps=="function"||typeof r.getSnapshotBeforeUpdate=="function"||typeof r.UNSAFE_componentWillMount!="function"&&typeof r.componentWillMount!="function"||(e=r.state,typeof r.componentWillMount=="function"&&r.componentWillMount(),typeof r.UNSAFE_componentWillMount=="function"&&r.UNSAFE_componentWillMount(),e!==r.state&&xu.enqueueReplaceState(r,r.state,null),Xc(n,t,r,i),r.state=n.memoizedState),typeof r.componentDidMount=="function"&&(n.flags|=4194308)}function Po(n,e){try{var t="",i=e;do t+=Wy(i),i=i.return;while(i);var r=t}catch(s){r=`
Error generating stack: `+s.message+`
`+s.stack}return{value:n,source:e,stack:r,digest:null}}function td(n,e,t){return{value:n,source:null,stack:t??null,digest:e??null}}function Rf(n,e){try{console.error(e.value)}catch(t){setTimeout(function(){throw t})}}var _M=typeof WeakMap=="function"?WeakMap:Map;function Hx(n,e,t){t=ur(-1,t),t.tag=3,t.payload={element:null};var i=e.value;return t.callback=function(){Zc||(Zc=!0,Ff=i),Rf(n,e)},t}function Vx(n,e,t){t=ur(-1,t),t.tag=3;var i=n.type.getDerivedStateFromError;if(typeof i=="function"){var r=e.value;t.payload=function(){return i(r)},t.callback=function(){Rf(n,e)}}var s=n.stateNode;return s!==null&&typeof s.componentDidCatch=="function"&&(t.callback=function(){Rf(n,e),typeof i!="function"&&(Gr===null?Gr=new Set([this]):Gr.add(this));var o=e.stack;this.componentDidCatch(e.value,{componentStack:o!==null?o:""})}),t}function Qm(n,e,t){var i=n.pingCache;if(i===null){i=n.pingCache=new _M;var r=new Set;i.set(e,r)}else r=i.get(e),r===void 0&&(r=new Set,i.set(e,r));r.has(t)||(r.add(t),n=LM.bind(null,n,e,t),e.then(n,n))}function eg(n){do{var e;if((e=n.tag===13)&&(e=n.memoizedState,e=e!==null?e.dehydrated!==null:!0),e)return n;n=n.return}while(n!==null);return null}function tg(n,e,t,i,r){return n.mode&1?(n.flags|=65536,n.lanes=r,n):(n===e?n.flags|=65536:(n.flags|=128,t.flags|=131072,t.flags&=-52805,t.tag===1&&(t.alternate===null?t.tag=17:(e=ur(-1,1),e.tag=2,Vr(t,e,1))),t.lanes|=1),n)}var xM=_r.ReactCurrentOwner,On=!1;function Tn(n,e,t,i){e.child=n===null?_x(e,null,t,i):Ro(e,n.child,t,i)}function ng(n,e,t,i,r){t=t.render;var s=e.ref;return xo(e,r),i=hp(n,e,t,i,s,r),t=pp(),n!==null&&!On?(e.updateQueue=n.updateQueue,e.flags&=-2053,n.lanes&=~r,mr(n,e,r)):(Ut&&t&&tp(e),e.flags|=1,Tn(n,e,i,r),e.child)}function ig(n,e,t,i,r){if(n===null){var s=t.type;return typeof s=="function"&&!wp(s)&&s.defaultProps===void 0&&t.compare===null&&t.defaultProps===void 0?(e.tag=15,e.type=s,Gx(n,e,s,i,r)):(n=Mc(t.type,null,i,e,e.mode,r),n.ref=e.ref,n.return=e,e.child=n)}if(s=n.child,!(n.lanes&r)){var o=s.memoizedProps;if(t=t.compare,t=t!==null?t:Ka,t(o,i)&&n.ref===e.ref)return mr(n,e,r)}return e.flags|=1,n=jr(s,i),n.ref=e.ref,n.return=e,e.child=n}function Gx(n,e,t,i,r){if(n!==null){var s=n.memoizedProps;if(Ka(s,i)&&n.ref===e.ref)if(On=!1,e.pendingProps=i=s,(n.lanes&r)!==0)n.flags&131072&&(On=!0);else return e.lanes=n.lanes,mr(n,e,r)}return Cf(n,e,t,i,r)}function Wx(n,e,t){var i=e.pendingProps,r=i.children,s=n!==null?n.memoizedState:null;if(i.mode==="hidden")if(!(e.mode&1))e.memoizedState={baseLanes:0,cachePool:null,transitions:null},Ct(uo,jn),jn|=t;else{if(!(t&1073741824))return n=s!==null?s.baseLanes|t:t,e.lanes=e.childLanes=1073741824,e.memoizedState={baseLanes:n,cachePool:null,transitions:null},e.updateQueue=null,Ct(uo,jn),jn|=n,null;e.memoizedState={baseLanes:0,cachePool:null,transitions:null},i=s!==null?s.baseLanes:t,Ct(uo,jn),jn|=i}else s!==null?(i=s.baseLanes|t,e.memoizedState=null):i=t,Ct(uo,jn),jn|=i;return Tn(n,e,r,t),e.child}function jx(n,e){var t=e.ref;(n===null&&t!==null||n!==null&&n.ref!==t)&&(e.flags|=512,e.flags|=2097152)}function Cf(n,e,t,i,r){var s=Bn(t)?ws:Sn.current;return s=bo(e,s),xo(e,r),t=hp(n,e,t,i,s,r),i=pp(),n!==null&&!On?(e.updateQueue=n.updateQueue,e.flags&=-2053,n.lanes&=~r,mr(n,e,r)):(Ut&&i&&tp(e),e.flags|=1,Tn(n,e,t,r),e.child)}function rg(n,e,t,i,r){if(Bn(t)){var s=!0;Hc(e)}else s=!1;if(xo(e,r),e.stateNode===null)vc(n,e),zx(e,t,i),Af(e,t,i,r),i=!0;else if(n===null){var o=e.stateNode,a=e.memoizedProps;o.props=a;var l=o.context,c=t.contextType;typeof c=="object"&&c!==null?c=ci(c):(c=Bn(t)?ws:Sn.current,c=bo(e,c));var u=t.getDerivedStateFromProps,d=typeof u=="function"||typeof o.getSnapshotBeforeUpdate=="function";d||typeof o.UNSAFE_componentWillReceiveProps!="function"&&typeof o.componentWillReceiveProps!="function"||(a!==i||l!==c)&&Jm(e,o,i,c),Pr=!1;var f=e.memoizedState;o.state=f,Xc(e,i,o,r),l=e.memoizedState,a!==i||f!==l||Fn.current||Pr?(typeof u=="function"&&(bf(e,t,u,i),l=e.memoizedState),(a=Pr||Zm(e,t,a,i,f,l,c))?(d||typeof o.UNSAFE_componentWillMount!="function"&&typeof o.componentWillMount!="function"||(typeof o.componentWillMount=="function"&&o.componentWillMount(),typeof o.UNSAFE_componentWillMount=="function"&&o.UNSAFE_componentWillMount()),typeof o.componentDidMount=="function"&&(e.flags|=4194308)):(typeof o.componentDidMount=="function"&&(e.flags|=4194308),e.memoizedProps=i,e.memoizedState=l),o.props=i,o.state=l,o.context=c,i=a):(typeof o.componentDidMount=="function"&&(e.flags|=4194308),i=!1)}else{o=e.stateNode,vx(n,e),a=e.memoizedProps,c=e.type===e.elementType?a:_i(e.type,a),o.props=c,d=e.pendingProps,f=o.context,l=t.contextType,typeof l=="object"&&l!==null?l=ci(l):(l=Bn(t)?ws:Sn.current,l=bo(e,l));var p=t.getDerivedStateFromProps;(u=typeof p=="function"||typeof o.getSnapshotBeforeUpdate=="function")||typeof o.UNSAFE_componentWillReceiveProps!="function"&&typeof o.componentWillReceiveProps!="function"||(a!==d||f!==l)&&Jm(e,o,i,l),Pr=!1,f=e.memoizedState,o.state=f,Xc(e,i,o,r);var g=e.memoizedState;a!==d||f!==g||Fn.current||Pr?(typeof p=="function"&&(bf(e,t,p,i),g=e.memoizedState),(c=Pr||Zm(e,t,c,i,f,g,l)||!1)?(u||typeof o.UNSAFE_componentWillUpdate!="function"&&typeof o.componentWillUpdate!="function"||(typeof o.componentWillUpdate=="function"&&o.componentWillUpdate(i,g,l),typeof o.UNSAFE_componentWillUpdate=="function"&&o.UNSAFE_componentWillUpdate(i,g,l)),typeof o.componentDidUpdate=="function"&&(e.flags|=4),typeof o.getSnapshotBeforeUpdate=="function"&&(e.flags|=1024)):(typeof o.componentDidUpdate!="function"||a===n.memoizedProps&&f===n.memoizedState||(e.flags|=4),typeof o.getSnapshotBeforeUpdate!="function"||a===n.memoizedProps&&f===n.memoizedState||(e.flags|=1024),e.memoizedProps=i,e.memoizedState=g),o.props=i,o.state=g,o.context=l,i=c):(typeof o.componentDidUpdate!="function"||a===n.memoizedProps&&f===n.memoizedState||(e.flags|=4),typeof o.getSnapshotBeforeUpdate!="function"||a===n.memoizedProps&&f===n.memoizedState||(e.flags|=1024),i=!1)}return Pf(n,e,t,i,s,r)}function Pf(n,e,t,i,r,s){jx(n,e);var o=(e.flags&128)!==0;if(!i&&!o)return r&&Gm(e,t,!1),mr(n,e,s);i=e.stateNode,xM.current=e;var a=o&&typeof t.getDerivedStateFromError!="function"?null:i.render();return e.flags|=1,n!==null&&o?(e.child=Ro(e,n.child,null,s),e.child=Ro(e,null,a,s)):Tn(n,e,a,s),e.memoizedState=i.state,r&&Gm(e,t,!0),e.child}function Xx(n){var e=n.stateNode;e.pendingContext?Vm(n,e.pendingContext,e.pendingContext!==e.context):e.context&&Vm(n,e.context,!1),cp(n,e.containerInfo)}function sg(n,e,t,i,r){return Ao(),ip(r),e.flags|=256,Tn(n,e,t,i),e.child}var Lf={dehydrated:null,treeContext:null,retryLane:0};function Nf(n){return{baseLanes:n,cachePool:null,transitions:null}}function Yx(n,e,t){var i=e.pendingProps,r=Ot.current,s=!1,o=(e.flags&128)!==0,a;if((a=o)||(a=n!==null&&n.memoizedState===null?!1:(r&2)!==0),a?(s=!0,e.flags&=-129):(n===null||n.memoizedState!==null)&&(r|=1),Ct(Ot,r&1),n===null)return wf(e),n=e.memoizedState,n!==null&&(n=n.dehydrated,n!==null)?(e.mode&1?n.data==="$!"?e.lanes=8:e.lanes=1073741824:e.lanes=1,null):(o=i.children,n=i.fallback,s?(i=e.mode,s=e.child,o={mode:"hidden",children:o},!(i&1)&&s!==null?(s.childLanes=0,s.pendingProps=o):s=Su(o,i,0,null),n=Es(n,i,t,null),s.return=e,n.return=e,s.sibling=n,e.child=s,e.child.memoizedState=Nf(t),e.memoizedState=Lf,n):_p(e,o));if(r=n.memoizedState,r!==null&&(a=r.dehydrated,a!==null))return vM(n,e,o,i,a,r,t);if(s){s=i.fallback,o=e.mode,r=n.child,a=r.sibling;var l={mode:"hidden",children:i.children};return!(o&1)&&e.child!==r?(i=e.child,i.childLanes=0,i.pendingProps=l,e.deletions=null):(i=jr(r,l),i.subtreeFlags=r.subtreeFlags&14680064),a!==null?s=jr(a,s):(s=Es(s,o,t,null),s.flags|=2),s.return=e,i.return=e,i.sibling=s,e.child=i,i=s,s=e.child,o=n.child.memoizedState,o=o===null?Nf(t):{baseLanes:o.baseLanes|t,cachePool:null,transitions:o.transitions},s.memoizedState=o,s.childLanes=n.childLanes&~t,e.memoizedState=Lf,i}return s=n.child,n=s.sibling,i=jr(s,{mode:"visible",children:i.children}),!(e.mode&1)&&(i.lanes=t),i.return=e,i.sibling=null,n!==null&&(t=e.deletions,t===null?(e.deletions=[n],e.flags|=16):t.push(n)),e.child=i,e.memoizedState=null,i}function _p(n,e){return e=Su({mode:"visible",children:e},n.mode,0,null),e.return=n,n.child=e}function Nl(n,e,t,i){return i!==null&&ip(i),Ro(e,n.child,null,t),n=_p(e,e.pendingProps.children),n.flags|=2,e.memoizedState=null,n}function vM(n,e,t,i,r,s,o){if(t)return e.flags&256?(e.flags&=-257,i=td(Error(le(422))),Nl(n,e,o,i)):e.memoizedState!==null?(e.child=n.child,e.flags|=128,null):(s=i.fallback,r=e.mode,i=Su({mode:"visible",children:i.children},r,0,null),s=Es(s,r,o,null),s.flags|=2,i.return=e,s.return=e,i.sibling=s,e.child=i,e.mode&1&&Ro(e,n.child,null,o),e.child.memoizedState=Nf(o),e.memoizedState=Lf,s);if(!(e.mode&1))return Nl(n,e,o,null);if(r.data==="$!"){if(i=r.nextSibling&&r.nextSibling.dataset,i)var a=i.dgst;return i=a,s=Error(le(419)),i=td(s,i,void 0),Nl(n,e,o,i)}if(a=(o&n.childLanes)!==0,On||a){if(i=sn,i!==null){switch(o&-o){case 4:r=2;break;case 16:r=8;break;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:r=32;break;case 536870912:r=268435456;break;default:r=0}r=r&(i.suspendedLanes|o)?0:r,r!==0&&r!==s.retryLane&&(s.retryLane=r,pr(n,r),wi(i,n,r,-1))}return Ep(),i=td(Error(le(421))),Nl(n,e,o,i)}return r.data==="$?"?(e.flags|=128,e.child=n.child,e=NM.bind(null,n),r._reactRetry=e,null):(n=s.treeContext,Xn=Hr(r.nextSibling),Kn=e,Ut=!0,vi=null,n!==null&&(ii[ri++]=or,ii[ri++]=ar,ii[ri++]=Ts,or=n.id,ar=n.overflow,Ts=e),e=_p(e,i.children),e.flags|=4096,e)}function og(n,e,t){n.lanes|=e;var i=n.alternate;i!==null&&(i.lanes|=e),Tf(n.return,e,t)}function nd(n,e,t,i,r){var s=n.memoizedState;s===null?n.memoizedState={isBackwards:e,rendering:null,renderingStartTime:0,last:i,tail:t,tailMode:r}:(s.isBackwards=e,s.rendering=null,s.renderingStartTime=0,s.last=i,s.tail=t,s.tailMode=r)}function Kx(n,e,t){var i=e.pendingProps,r=i.revealOrder,s=i.tail;if(Tn(n,e,i.children,t),i=Ot.current,i&2)i=i&1|2,e.flags|=128;else{if(n!==null&&n.flags&128)e:for(n=e.child;n!==null;){if(n.tag===13)n.memoizedState!==null&&og(n,t,e);else if(n.tag===19)og(n,t,e);else if(n.child!==null){n.child.return=n,n=n.child;continue}if(n===e)break e;for(;n.sibling===null;){if(n.return===null||n.return===e)break e;n=n.return}n.sibling.return=n.return,n=n.sibling}i&=1}if(Ct(Ot,i),!(e.mode&1))e.memoizedState=null;else switch(r){case"forwards":for(t=e.child,r=null;t!==null;)n=t.alternate,n!==null&&Yc(n)===null&&(r=t),t=t.sibling;t=r,t===null?(r=e.child,e.child=null):(r=t.sibling,t.sibling=null),nd(e,!1,r,t,s);break;case"backwards":for(t=null,r=e.child,e.child=null;r!==null;){if(n=r.alternate,n!==null&&Yc(n)===null){e.child=r;break}n=r.sibling,r.sibling=t,t=r,r=n}nd(e,!0,t,null,s);break;case"together":nd(e,!1,null,null,void 0);break;default:e.memoizedState=null}return e.child}function vc(n,e){!(e.mode&1)&&n!==null&&(n.alternate=null,e.alternate=null,e.flags|=2)}function mr(n,e,t){if(n!==null&&(e.dependencies=n.dependencies),As|=e.lanes,!(t&e.childLanes))return null;if(n!==null&&e.child!==n.child)throw Error(le(153));if(e.child!==null){for(n=e.child,t=jr(n,n.pendingProps),e.child=t,t.return=e;n.sibling!==null;)n=n.sibling,t=t.sibling=jr(n,n.pendingProps),t.return=e;t.sibling=null}return e.child}function yM(n,e,t){switch(e.tag){case 3:Xx(e),Ao();break;case 5:yx(e);break;case 1:Bn(e.type)&&Hc(e);break;case 4:cp(e,e.stateNode.containerInfo);break;case 10:var i=e.type._context,r=e.memoizedProps.value;Ct(Wc,i._currentValue),i._currentValue=r;break;case 13:if(i=e.memoizedState,i!==null)return i.dehydrated!==null?(Ct(Ot,Ot.current&1),e.flags|=128,null):t&e.child.childLanes?Yx(n,e,t):(Ct(Ot,Ot.current&1),n=mr(n,e,t),n!==null?n.sibling:null);Ct(Ot,Ot.current&1);break;case 19:if(i=(t&e.childLanes)!==0,n.flags&128){if(i)return Kx(n,e,t);e.flags|=128}if(r=e.memoizedState,r!==null&&(r.rendering=null,r.tail=null,r.lastEffect=null),Ct(Ot,Ot.current),i)break;return null;case 22:case 23:return e.lanes=0,Wx(n,e,t)}return mr(n,e,t)}var qx,Df,$x,Zx;qx=function(n,e){for(var t=e.child;t!==null;){if(t.tag===5||t.tag===6)n.appendChild(t.stateNode);else if(t.tag!==4&&t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return;t=t.return}t.sibling.return=t.return,t=t.sibling}};Df=function(){};$x=function(n,e,t,i){var r=n.memoizedProps;if(r!==i){n=e.stateNode,ys(Bi.current);var s=null;switch(t){case"input":r=ef(n,r),i=ef(n,i),s=[];break;case"select":r=zt({},r,{value:void 0}),i=zt({},i,{value:void 0}),s=[];break;case"textarea":r=rf(n,r),i=rf(n,i),s=[];break;default:typeof r.onClick!="function"&&typeof i.onClick=="function"&&(n.onclick=Bc)}of(t,i);var o;t=null;for(c in r)if(!i.hasOwnProperty(c)&&r.hasOwnProperty(c)&&r[c]!=null)if(c==="style"){var a=r[c];for(o in a)a.hasOwnProperty(o)&&(t||(t={}),t[o]="")}else c!=="dangerouslySetInnerHTML"&&c!=="children"&&c!=="suppressContentEditableWarning"&&c!=="suppressHydrationWarning"&&c!=="autoFocus"&&(Ha.hasOwnProperty(c)?s||(s=[]):(s=s||[]).push(c,null));for(c in i){var l=i[c];if(a=r!=null?r[c]:void 0,i.hasOwnProperty(c)&&l!==a&&(l!=null||a!=null))if(c==="style")if(a){for(o in a)!a.hasOwnProperty(o)||l&&l.hasOwnProperty(o)||(t||(t={}),t[o]="");for(o in l)l.hasOwnProperty(o)&&a[o]!==l[o]&&(t||(t={}),t[o]=l[o])}else t||(s||(s=[]),s.push(c,t)),t=l;else c==="dangerouslySetInnerHTML"?(l=l?l.__html:void 0,a=a?a.__html:void 0,l!=null&&a!==l&&(s=s||[]).push(c,l)):c==="children"?typeof l!="string"&&typeof l!="number"||(s=s||[]).push(c,""+l):c!=="suppressContentEditableWarning"&&c!=="suppressHydrationWarning"&&(Ha.hasOwnProperty(c)?(l!=null&&c==="onScroll"&&Lt("scroll",n),s||a===l||(s=[])):(s=s||[]).push(c,l))}t&&(s=s||[]).push("style",t);var c=s;(e.updateQueue=c)&&(e.flags|=4)}};Zx=function(n,e,t,i){t!==i&&(e.flags|=4)};function la(n,e){if(!Ut)switch(n.tailMode){case"hidden":e=n.tail;for(var t=null;e!==null;)e.alternate!==null&&(t=e),e=e.sibling;t===null?n.tail=null:t.sibling=null;break;case"collapsed":t=n.tail;for(var i=null;t!==null;)t.alternate!==null&&(i=t),t=t.sibling;i===null?e||n.tail===null?n.tail=null:n.tail.sibling=null:i.sibling=null}}function _n(n){var e=n.alternate!==null&&n.alternate.child===n.child,t=0,i=0;if(e)for(var r=n.child;r!==null;)t|=r.lanes|r.childLanes,i|=r.subtreeFlags&14680064,i|=r.flags&14680064,r.return=n,r=r.sibling;else for(r=n.child;r!==null;)t|=r.lanes|r.childLanes,i|=r.subtreeFlags,i|=r.flags,r.return=n,r=r.sibling;return n.subtreeFlags|=i,n.childLanes=t,e}function SM(n,e,t){var i=e.pendingProps;switch(np(e),e.tag){case 2:case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return _n(e),null;case 1:return Bn(e.type)&&zc(),_n(e),null;case 3:return i=e.stateNode,Co(),Dt(Fn),Dt(Sn),dp(),i.pendingContext&&(i.context=i.pendingContext,i.pendingContext=null),(n===null||n.child===null)&&(Pl(e)?e.flags|=4:n===null||n.memoizedState.isDehydrated&&!(e.flags&256)||(e.flags|=1024,vi!==null&&(Hf(vi),vi=null))),Df(n,e),_n(e),null;case 5:up(e);var r=ys(Qa.current);if(t=e.type,n!==null&&e.stateNode!=null)$x(n,e,t,i,r),n.ref!==e.ref&&(e.flags|=512,e.flags|=2097152);else{if(!i){if(e.stateNode===null)throw Error(le(166));return _n(e),null}if(n=ys(Bi.current),Pl(e)){i=e.stateNode,t=e.type;var s=e.memoizedProps;switch(i[Ui]=e,i[Za]=s,n=(e.mode&1)!==0,t){case"dialog":Lt("cancel",i),Lt("close",i);break;case"iframe":case"object":case"embed":Lt("load",i);break;case"video":case"audio":for(r=0;r<ba.length;r++)Lt(ba[r],i);break;case"source":Lt("error",i);break;case"img":case"image":case"link":Lt("error",i),Lt("load",i);break;case"details":Lt("toggle",i);break;case"input":mm(i,s),Lt("invalid",i);break;case"select":i._wrapperState={wasMultiple:!!s.multiple},Lt("invalid",i);break;case"textarea":_m(i,s),Lt("invalid",i)}of(t,s),r=null;for(var o in s)if(s.hasOwnProperty(o)){var a=s[o];o==="children"?typeof a=="string"?i.textContent!==a&&(s.suppressHydrationWarning!==!0&&Cl(i.textContent,a,n),r=["children",a]):typeof a=="number"&&i.textContent!==""+a&&(s.suppressHydrationWarning!==!0&&Cl(i.textContent,a,n),r=["children",""+a]):Ha.hasOwnProperty(o)&&a!=null&&o==="onScroll"&&Lt("scroll",i)}switch(t){case"input":Sl(i),gm(i,s,!0);break;case"textarea":Sl(i),xm(i);break;case"select":case"option":break;default:typeof s.onClick=="function"&&(i.onclick=Bc)}i=r,e.updateQueue=i,i!==null&&(e.flags|=4)}else{o=r.nodeType===9?r:r.ownerDocument,n==="http://www.w3.org/1999/xhtml"&&(n=T_(t)),n==="http://www.w3.org/1999/xhtml"?t==="script"?(n=o.createElement("div"),n.innerHTML="<script><\/script>",n=n.removeChild(n.firstChild)):typeof i.is=="string"?n=o.createElement(t,{is:i.is}):(n=o.createElement(t),t==="select"&&(o=n,i.multiple?o.multiple=!0:i.size&&(o.size=i.size))):n=o.createElementNS(n,t),n[Ui]=e,n[Za]=i,qx(n,e,!1,!1),e.stateNode=n;e:{switch(o=af(t,i),t){case"dialog":Lt("cancel",n),Lt("close",n),r=i;break;case"iframe":case"object":case"embed":Lt("load",n),r=i;break;case"video":case"audio":for(r=0;r<ba.length;r++)Lt(ba[r],n);r=i;break;case"source":Lt("error",n),r=i;break;case"img":case"image":case"link":Lt("error",n),Lt("load",n),r=i;break;case"details":Lt("toggle",n),r=i;break;case"input":mm(n,i),r=ef(n,i),Lt("invalid",n);break;case"option":r=i;break;case"select":n._wrapperState={wasMultiple:!!i.multiple},r=zt({},i,{value:void 0}),Lt("invalid",n);break;case"textarea":_m(n,i),r=rf(n,i),Lt("invalid",n);break;default:r=i}of(t,r),a=r;for(s in a)if(a.hasOwnProperty(s)){var l=a[s];s==="style"?R_(n,l):s==="dangerouslySetInnerHTML"?(l=l?l.__html:void 0,l!=null&&b_(n,l)):s==="children"?typeof l=="string"?(t!=="textarea"||l!=="")&&Va(n,l):typeof l=="number"&&Va(n,""+l):s!=="suppressContentEditableWarning"&&s!=="suppressHydrationWarning"&&s!=="autoFocus"&&(Ha.hasOwnProperty(s)?l!=null&&s==="onScroll"&&Lt("scroll",n):l!=null&&Hh(n,s,l,o))}switch(t){case"input":Sl(n),gm(n,i,!1);break;case"textarea":Sl(n),xm(n);break;case"option":i.value!=null&&n.setAttribute("value",""+Yr(i.value));break;case"select":n.multiple=!!i.multiple,s=i.value,s!=null?po(n,!!i.multiple,s,!1):i.defaultValue!=null&&po(n,!!i.multiple,i.defaultValue,!0);break;default:typeof r.onClick=="function"&&(n.onclick=Bc)}switch(t){case"button":case"input":case"select":case"textarea":i=!!i.autoFocus;break e;case"img":i=!0;break e;default:i=!1}}i&&(e.flags|=4)}e.ref!==null&&(e.flags|=512,e.flags|=2097152)}return _n(e),null;case 6:if(n&&e.stateNode!=null)Zx(n,e,n.memoizedProps,i);else{if(typeof i!="string"&&e.stateNode===null)throw Error(le(166));if(t=ys(Qa.current),ys(Bi.current),Pl(e)){if(i=e.stateNode,t=e.memoizedProps,i[Ui]=e,(s=i.nodeValue!==t)&&(n=Kn,n!==null))switch(n.tag){case 3:Cl(i.nodeValue,t,(n.mode&1)!==0);break;case 5:n.memoizedProps.suppressHydrationWarning!==!0&&Cl(i.nodeValue,t,(n.mode&1)!==0)}s&&(e.flags|=4)}else i=(t.nodeType===9?t:t.ownerDocument).createTextNode(i),i[Ui]=e,e.stateNode=i}return _n(e),null;case 13:if(Dt(Ot),i=e.memoizedState,n===null||n.memoizedState!==null&&n.memoizedState.dehydrated!==null){if(Ut&&Xn!==null&&e.mode&1&&!(e.flags&128))mx(),Ao(),e.flags|=98560,s=!1;else if(s=Pl(e),i!==null&&i.dehydrated!==null){if(n===null){if(!s)throw Error(le(318));if(s=e.memoizedState,s=s!==null?s.dehydrated:null,!s)throw Error(le(317));s[Ui]=e}else Ao(),!(e.flags&128)&&(e.memoizedState=null),e.flags|=4;_n(e),s=!1}else vi!==null&&(Hf(vi),vi=null),s=!0;if(!s)return e.flags&65536?e:null}return e.flags&128?(e.lanes=t,e):(i=i!==null,i!==(n!==null&&n.memoizedState!==null)&&i&&(e.child.flags|=8192,e.mode&1&&(n===null||Ot.current&1?Qt===0&&(Qt=3):Ep())),e.updateQueue!==null&&(e.flags|=4),_n(e),null);case 4:return Co(),Df(n,e),n===null&&qa(e.stateNode.containerInfo),_n(e),null;case 10:return op(e.type._context),_n(e),null;case 17:return Bn(e.type)&&zc(),_n(e),null;case 19:if(Dt(Ot),s=e.memoizedState,s===null)return _n(e),null;if(i=(e.flags&128)!==0,o=s.rendering,o===null)if(i)la(s,!1);else{if(Qt!==0||n!==null&&n.flags&128)for(n=e.child;n!==null;){if(o=Yc(n),o!==null){for(e.flags|=128,la(s,!1),i=o.updateQueue,i!==null&&(e.updateQueue=i,e.flags|=4),e.subtreeFlags=0,i=t,t=e.child;t!==null;)s=t,n=i,s.flags&=14680066,o=s.alternate,o===null?(s.childLanes=0,s.lanes=n,s.child=null,s.subtreeFlags=0,s.memoizedProps=null,s.memoizedState=null,s.updateQueue=null,s.dependencies=null,s.stateNode=null):(s.childLanes=o.childLanes,s.lanes=o.lanes,s.child=o.child,s.subtreeFlags=0,s.deletions=null,s.memoizedProps=o.memoizedProps,s.memoizedState=o.memoizedState,s.updateQueue=o.updateQueue,s.type=o.type,n=o.dependencies,s.dependencies=n===null?null:{lanes:n.lanes,firstContext:n.firstContext}),t=t.sibling;return Ct(Ot,Ot.current&1|2),e.child}n=n.sibling}s.tail!==null&&Xt()>Lo&&(e.flags|=128,i=!0,la(s,!1),e.lanes=4194304)}else{if(!i)if(n=Yc(o),n!==null){if(e.flags|=128,i=!0,t=n.updateQueue,t!==null&&(e.updateQueue=t,e.flags|=4),la(s,!0),s.tail===null&&s.tailMode==="hidden"&&!o.alternate&&!Ut)return _n(e),null}else 2*Xt()-s.renderingStartTime>Lo&&t!==1073741824&&(e.flags|=128,i=!0,la(s,!1),e.lanes=4194304);s.isBackwards?(o.sibling=e.child,e.child=o):(t=s.last,t!==null?t.sibling=o:e.child=o,s.last=o)}return s.tail!==null?(e=s.tail,s.rendering=e,s.tail=e.sibling,s.renderingStartTime=Xt(),e.sibling=null,t=Ot.current,Ct(Ot,i?t&1|2:t&1),e):(_n(e),null);case 22:case 23:return Mp(),i=e.memoizedState!==null,n!==null&&n.memoizedState!==null!==i&&(e.flags|=8192),i&&e.mode&1?jn&1073741824&&(_n(e),e.subtreeFlags&6&&(e.flags|=8192)):_n(e),null;case 24:return null;case 25:return null}throw Error(le(156,e.tag))}function MM(n,e){switch(np(e),e.tag){case 1:return Bn(e.type)&&zc(),n=e.flags,n&65536?(e.flags=n&-65537|128,e):null;case 3:return Co(),Dt(Fn),Dt(Sn),dp(),n=e.flags,n&65536&&!(n&128)?(e.flags=n&-65537|128,e):null;case 5:return up(e),null;case 13:if(Dt(Ot),n=e.memoizedState,n!==null&&n.dehydrated!==null){if(e.alternate===null)throw Error(le(340));Ao()}return n=e.flags,n&65536?(e.flags=n&-65537|128,e):null;case 19:return Dt(Ot),null;case 4:return Co(),null;case 10:return op(e.type._context),null;case 22:case 23:return Mp(),null;case 24:return null;default:return null}}var Dl=!1,yn=!1,EM=typeof WeakSet=="function"?WeakSet:Set,Re=null;function co(n,e){var t=n.ref;if(t!==null)if(typeof t=="function")try{t(null)}catch(i){Vt(n,e,i)}else t.current=null}function If(n,e,t){try{t()}catch(i){Vt(n,e,i)}}var ag=!1;function wM(n,e){if(_f=kc,n=nx(),ep(n)){if("selectionStart"in n)var t={start:n.selectionStart,end:n.selectionEnd};else e:{t=(t=n.ownerDocument)&&t.defaultView||window;var i=t.getSelection&&t.getSelection();if(i&&i.rangeCount!==0){t=i.anchorNode;var r=i.anchorOffset,s=i.focusNode;i=i.focusOffset;try{t.nodeType,s.nodeType}catch{t=null;break e}var o=0,a=-1,l=-1,c=0,u=0,d=n,f=null;t:for(;;){for(var p;d!==t||r!==0&&d.nodeType!==3||(a=o+r),d!==s||i!==0&&d.nodeType!==3||(l=o+i),d.nodeType===3&&(o+=d.nodeValue.length),(p=d.firstChild)!==null;)f=d,d=p;for(;;){if(d===n)break t;if(f===t&&++c===r&&(a=o),f===s&&++u===i&&(l=o),(p=d.nextSibling)!==null)break;d=f,f=d.parentNode}d=p}t=a===-1||l===-1?null:{start:a,end:l}}else t=null}t=t||{start:0,end:0}}else t=null;for(xf={focusedElem:n,selectionRange:t},kc=!1,Re=e;Re!==null;)if(e=Re,n=e.child,(e.subtreeFlags&1028)!==0&&n!==null)n.return=e,Re=n;else for(;Re!==null;){e=Re;try{var g=e.alternate;if(e.flags&1024)switch(e.tag){case 0:case 11:case 15:break;case 1:if(g!==null){var v=g.memoizedProps,m=g.memoizedState,h=e.stateNode,_=h.getSnapshotBeforeUpdate(e.elementType===e.type?v:_i(e.type,v),m);h.__reactInternalSnapshotBeforeUpdate=_}break;case 3:var x=e.stateNode.containerInfo;x.nodeType===1?x.textContent="":x.nodeType===9&&x.documentElement&&x.removeChild(x.documentElement);break;case 5:case 6:case 4:case 17:break;default:throw Error(le(163))}}catch(M){Vt(e,e.return,M)}if(n=e.sibling,n!==null){n.return=e.return,Re=n;break}Re=e.return}return g=ag,ag=!1,g}function Ua(n,e,t){var i=e.updateQueue;if(i=i!==null?i.lastEffect:null,i!==null){var r=i=i.next;do{if((r.tag&n)===n){var s=r.destroy;r.destroy=void 0,s!==void 0&&If(e,t,s)}r=r.next}while(r!==i)}}function vu(n,e){if(e=e.updateQueue,e=e!==null?e.lastEffect:null,e!==null){var t=e=e.next;do{if((t.tag&n)===n){var i=t.create;t.destroy=i()}t=t.next}while(t!==e)}}function Uf(n){var e=n.ref;if(e!==null){var t=n.stateNode;switch(n.tag){case 5:n=t;break;default:n=t}typeof e=="function"?e(n):e.current=n}}function Jx(n){var e=n.alternate;e!==null&&(n.alternate=null,Jx(e)),n.child=null,n.deletions=null,n.sibling=null,n.tag===5&&(e=n.stateNode,e!==null&&(delete e[Ui],delete e[Za],delete e[Sf],delete e[oM],delete e[aM])),n.stateNode=null,n.return=null,n.dependencies=null,n.memoizedProps=null,n.memoizedState=null,n.pendingProps=null,n.stateNode=null,n.updateQueue=null}function Qx(n){return n.tag===5||n.tag===3||n.tag===4}function lg(n){e:for(;;){for(;n.sibling===null;){if(n.return===null||Qx(n.return))return null;n=n.return}for(n.sibling.return=n.return,n=n.sibling;n.tag!==5&&n.tag!==6&&n.tag!==18;){if(n.flags&2||n.child===null||n.tag===4)continue e;n.child.return=n,n=n.child}if(!(n.flags&2))return n.stateNode}}function kf(n,e,t){var i=n.tag;if(i===5||i===6)n=n.stateNode,e?t.nodeType===8?t.parentNode.insertBefore(n,e):t.insertBefore(n,e):(t.nodeType===8?(e=t.parentNode,e.insertBefore(n,t)):(e=t,e.appendChild(n)),t=t._reactRootContainer,t!=null||e.onclick!==null||(e.onclick=Bc));else if(i!==4&&(n=n.child,n!==null))for(kf(n,e,t),n=n.sibling;n!==null;)kf(n,e,t),n=n.sibling}function Of(n,e,t){var i=n.tag;if(i===5||i===6)n=n.stateNode,e?t.insertBefore(n,e):t.appendChild(n);else if(i!==4&&(n=n.child,n!==null))for(Of(n,e,t),n=n.sibling;n!==null;)Of(n,e,t),n=n.sibling}var un=null,xi=!1;function Sr(n,e,t){for(t=t.child;t!==null;)ev(n,e,t),t=t.sibling}function ev(n,e,t){if(Fi&&typeof Fi.onCommitFiberUnmount=="function")try{Fi.onCommitFiberUnmount(du,t)}catch{}switch(t.tag){case 5:yn||co(t,e);case 6:var i=un,r=xi;un=null,Sr(n,e,t),un=i,xi=r,un!==null&&(xi?(n=un,t=t.stateNode,n.nodeType===8?n.parentNode.removeChild(t):n.removeChild(t)):un.removeChild(t.stateNode));break;case 18:un!==null&&(xi?(n=un,t=t.stateNode,n.nodeType===8?qu(n.parentNode,t):n.nodeType===1&&qu(n,t),Xa(n)):qu(un,t.stateNode));break;case 4:i=un,r=xi,un=t.stateNode.containerInfo,xi=!0,Sr(n,e,t),un=i,xi=r;break;case 0:case 11:case 14:case 15:if(!yn&&(i=t.updateQueue,i!==null&&(i=i.lastEffect,i!==null))){r=i=i.next;do{var s=r,o=s.destroy;s=s.tag,o!==void 0&&(s&2||s&4)&&If(t,e,o),r=r.next}while(r!==i)}Sr(n,e,t);break;case 1:if(!yn&&(co(t,e),i=t.stateNode,typeof i.componentWillUnmount=="function"))try{i.props=t.memoizedProps,i.state=t.memoizedState,i.componentWillUnmount()}catch(a){Vt(t,e,a)}Sr(n,e,t);break;case 21:Sr(n,e,t);break;case 22:t.mode&1?(yn=(i=yn)||t.memoizedState!==null,Sr(n,e,t),yn=i):Sr(n,e,t);break;default:Sr(n,e,t)}}function cg(n){var e=n.updateQueue;if(e!==null){n.updateQueue=null;var t=n.stateNode;t===null&&(t=n.stateNode=new EM),e.forEach(function(i){var r=DM.bind(null,n,i);t.has(i)||(t.add(i),i.then(r,r))})}}function hi(n,e){var t=e.deletions;if(t!==null)for(var i=0;i<t.length;i++){var r=t[i];try{var s=n,o=e,a=o;e:for(;a!==null;){switch(a.tag){case 5:un=a.stateNode,xi=!1;break e;case 3:un=a.stateNode.containerInfo,xi=!0;break e;case 4:un=a.stateNode.containerInfo,xi=!0;break e}a=a.return}if(un===null)throw Error(le(160));ev(s,o,r),un=null,xi=!1;var l=r.alternate;l!==null&&(l.return=null),r.return=null}catch(c){Vt(r,e,c)}}if(e.subtreeFlags&12854)for(e=e.child;e!==null;)tv(e,n),e=e.sibling}function tv(n,e){var t=n.alternate,i=n.flags;switch(n.tag){case 0:case 11:case 14:case 15:if(hi(e,n),Ni(n),i&4){try{Ua(3,n,n.return),vu(3,n)}catch(v){Vt(n,n.return,v)}try{Ua(5,n,n.return)}catch(v){Vt(n,n.return,v)}}break;case 1:hi(e,n),Ni(n),i&512&&t!==null&&co(t,t.return);break;case 5:if(hi(e,n),Ni(n),i&512&&t!==null&&co(t,t.return),n.flags&32){var r=n.stateNode;try{Va(r,"")}catch(v){Vt(n,n.return,v)}}if(i&4&&(r=n.stateNode,r!=null)){var s=n.memoizedProps,o=t!==null?t.memoizedProps:s,a=n.type,l=n.updateQueue;if(n.updateQueue=null,l!==null)try{a==="input"&&s.type==="radio"&&s.name!=null&&E_(r,s),af(a,o);var c=af(a,s);for(o=0;o<l.length;o+=2){var u=l[o],d=l[o+1];u==="style"?R_(r,d):u==="dangerouslySetInnerHTML"?b_(r,d):u==="children"?Va(r,d):Hh(r,u,d,c)}switch(a){case"input":tf(r,s);break;case"textarea":w_(r,s);break;case"select":var f=r._wrapperState.wasMultiple;r._wrapperState.wasMultiple=!!s.multiple;var p=s.value;p!=null?po(r,!!s.multiple,p,!1):f!==!!s.multiple&&(s.defaultValue!=null?po(r,!!s.multiple,s.defaultValue,!0):po(r,!!s.multiple,s.multiple?[]:"",!1))}r[Za]=s}catch(v){Vt(n,n.return,v)}}break;case 6:if(hi(e,n),Ni(n),i&4){if(n.stateNode===null)throw Error(le(162));r=n.stateNode,s=n.memoizedProps;try{r.nodeValue=s}catch(v){Vt(n,n.return,v)}}break;case 3:if(hi(e,n),Ni(n),i&4&&t!==null&&t.memoizedState.isDehydrated)try{Xa(e.containerInfo)}catch(v){Vt(n,n.return,v)}break;case 4:hi(e,n),Ni(n);break;case 13:hi(e,n),Ni(n),r=n.child,r.flags&8192&&(s=r.memoizedState!==null,r.stateNode.isHidden=s,!s||r.alternate!==null&&r.alternate.memoizedState!==null||(yp=Xt())),i&4&&cg(n);break;case 22:if(u=t!==null&&t.memoizedState!==null,n.mode&1?(yn=(c=yn)||u,hi(e,n),yn=c):hi(e,n),Ni(n),i&8192){if(c=n.memoizedState!==null,(n.stateNode.isHidden=c)&&!u&&n.mode&1)for(Re=n,u=n.child;u!==null;){for(d=Re=u;Re!==null;){switch(f=Re,p=f.child,f.tag){case 0:case 11:case 14:case 15:Ua(4,f,f.return);break;case 1:co(f,f.return);var g=f.stateNode;if(typeof g.componentWillUnmount=="function"){i=f,t=f.return;try{e=i,g.props=e.memoizedProps,g.state=e.memoizedState,g.componentWillUnmount()}catch(v){Vt(i,t,v)}}break;case 5:co(f,f.return);break;case 22:if(f.memoizedState!==null){dg(d);continue}}p!==null?(p.return=f,Re=p):dg(d)}u=u.sibling}e:for(u=null,d=n;;){if(d.tag===5){if(u===null){u=d;try{r=d.stateNode,c?(s=r.style,typeof s.setProperty=="function"?s.setProperty("display","none","important"):s.display="none"):(a=d.stateNode,l=d.memoizedProps.style,o=l!=null&&l.hasOwnProperty("display")?l.display:null,a.style.display=A_("display",o))}catch(v){Vt(n,n.return,v)}}}else if(d.tag===6){if(u===null)try{d.stateNode.nodeValue=c?"":d.memoizedProps}catch(v){Vt(n,n.return,v)}}else if((d.tag!==22&&d.tag!==23||d.memoizedState===null||d===n)&&d.child!==null){d.child.return=d,d=d.child;continue}if(d===n)break e;for(;d.sibling===null;){if(d.return===null||d.return===n)break e;u===d&&(u=null),d=d.return}u===d&&(u=null),d.sibling.return=d.return,d=d.sibling}}break;case 19:hi(e,n),Ni(n),i&4&&cg(n);break;case 21:break;default:hi(e,n),Ni(n)}}function Ni(n){var e=n.flags;if(e&2){try{e:{for(var t=n.return;t!==null;){if(Qx(t)){var i=t;break e}t=t.return}throw Error(le(160))}switch(i.tag){case 5:var r=i.stateNode;i.flags&32&&(Va(r,""),i.flags&=-33);var s=lg(n);Of(n,s,r);break;case 3:case 4:var o=i.stateNode.containerInfo,a=lg(n);kf(n,a,o);break;default:throw Error(le(161))}}catch(l){Vt(n,n.return,l)}n.flags&=-3}e&4096&&(n.flags&=-4097)}function TM(n,e,t){Re=n,nv(n)}function nv(n,e,t){for(var i=(n.mode&1)!==0;Re!==null;){var r=Re,s=r.child;if(r.tag===22&&i){var o=r.memoizedState!==null||Dl;if(!o){var a=r.alternate,l=a!==null&&a.memoizedState!==null||yn;a=Dl;var c=yn;if(Dl=o,(yn=l)&&!c)for(Re=r;Re!==null;)o=Re,l=o.child,o.tag===22&&o.memoizedState!==null?fg(r):l!==null?(l.return=o,Re=l):fg(r);for(;s!==null;)Re=s,nv(s),s=s.sibling;Re=r,Dl=a,yn=c}ug(n)}else r.subtreeFlags&8772&&s!==null?(s.return=r,Re=s):ug(n)}}function ug(n){for(;Re!==null;){var e=Re;if(e.flags&8772){var t=e.alternate;try{if(e.flags&8772)switch(e.tag){case 0:case 11:case 15:yn||vu(5,e);break;case 1:var i=e.stateNode;if(e.flags&4&&!yn)if(t===null)i.componentDidMount();else{var r=e.elementType===e.type?t.memoizedProps:_i(e.type,t.memoizedProps);i.componentDidUpdate(r,t.memoizedState,i.__reactInternalSnapshotBeforeUpdate)}var s=e.updateQueue;s!==null&&Km(e,s,i);break;case 3:var o=e.updateQueue;if(o!==null){if(t=null,e.child!==null)switch(e.child.tag){case 5:t=e.child.stateNode;break;case 1:t=e.child.stateNode}Km(e,o,t)}break;case 5:var a=e.stateNode;if(t===null&&e.flags&4){t=a;var l=e.memoizedProps;switch(e.type){case"button":case"input":case"select":case"textarea":l.autoFocus&&t.focus();break;case"img":l.src&&(t.src=l.src)}}break;case 6:break;case 4:break;case 12:break;case 13:if(e.memoizedState===null){var c=e.alternate;if(c!==null){var u=c.memoizedState;if(u!==null){var d=u.dehydrated;d!==null&&Xa(d)}}}break;case 19:case 17:case 21:case 22:case 23:case 25:break;default:throw Error(le(163))}yn||e.flags&512&&Uf(e)}catch(f){Vt(e,e.return,f)}}if(e===n){Re=null;break}if(t=e.sibling,t!==null){t.return=e.return,Re=t;break}Re=e.return}}function dg(n){for(;Re!==null;){var e=Re;if(e===n){Re=null;break}var t=e.sibling;if(t!==null){t.return=e.return,Re=t;break}Re=e.return}}function fg(n){for(;Re!==null;){var e=Re;try{switch(e.tag){case 0:case 11:case 15:var t=e.return;try{vu(4,e)}catch(l){Vt(e,t,l)}break;case 1:var i=e.stateNode;if(typeof i.componentDidMount=="function"){var r=e.return;try{i.componentDidMount()}catch(l){Vt(e,r,l)}}var s=e.return;try{Uf(e)}catch(l){Vt(e,s,l)}break;case 5:var o=e.return;try{Uf(e)}catch(l){Vt(e,o,l)}}}catch(l){Vt(e,e.return,l)}if(e===n){Re=null;break}var a=e.sibling;if(a!==null){a.return=e.return,Re=a;break}Re=e.return}}var bM=Math.ceil,$c=_r.ReactCurrentDispatcher,xp=_r.ReactCurrentOwner,li=_r.ReactCurrentBatchConfig,gt=0,sn=null,qt=null,fn=0,jn=0,uo=Zr(0),Qt=0,il=null,As=0,yu=0,vp=0,ka=null,Un=null,yp=0,Lo=1/0,tr=null,Zc=!1,Ff=null,Gr=null,Il=!1,Ur=null,Jc=0,Oa=0,Bf=null,yc=-1,Sc=0;function Rn(){return gt&6?Xt():yc!==-1?yc:yc=Xt()}function Wr(n){return n.mode&1?gt&2&&fn!==0?fn&-fn:cM.transition!==null?(Sc===0&&(Sc=z_()),Sc):(n=wt,n!==0||(n=window.event,n=n===void 0?16:Y_(n.type)),n):1}function wi(n,e,t,i){if(50<Oa)throw Oa=0,Bf=null,Error(le(185));cl(n,t,i),(!(gt&2)||n!==sn)&&(n===sn&&(!(gt&2)&&(yu|=t),Qt===4&&Nr(n,fn)),zn(n,i),t===1&&gt===0&&!(e.mode&1)&&(Lo=Xt()+500,gu&&Jr()))}function zn(n,e){var t=n.callbackNode;cS(n,e);var i=Uc(n,n===sn?fn:0);if(i===0)t!==null&&Sm(t),n.callbackNode=null,n.callbackPriority=0;else if(e=i&-i,n.callbackPriority!==e){if(t!=null&&Sm(t),e===1)n.tag===0?lM(hg.bind(null,n)):fx(hg.bind(null,n)),rM(function(){!(gt&6)&&Jr()}),t=null;else{switch(H_(i)){case 1:t=Xh;break;case 4:t=F_;break;case 16:t=Ic;break;case 536870912:t=B_;break;default:t=Ic}t=uv(t,iv.bind(null,n))}n.callbackPriority=e,n.callbackNode=t}}function iv(n,e){if(yc=-1,Sc=0,gt&6)throw Error(le(327));var t=n.callbackNode;if(vo()&&n.callbackNode!==t)return null;var i=Uc(n,n===sn?fn:0);if(i===0)return null;if(i&30||i&n.expiredLanes||e)e=Qc(n,i);else{e=i;var r=gt;gt|=2;var s=sv();(sn!==n||fn!==e)&&(tr=null,Lo=Xt()+500,Ms(n,e));do try{CM();break}catch(a){rv(n,a)}while(!0);sp(),$c.current=s,gt=r,qt!==null?e=0:(sn=null,fn=0,e=Qt)}if(e!==0){if(e===2&&(r=ff(n),r!==0&&(i=r,e=zf(n,r))),e===1)throw t=il,Ms(n,0),Nr(n,i),zn(n,Xt()),t;if(e===6)Nr(n,i);else{if(r=n.current.alternate,!(i&30)&&!AM(r)&&(e=Qc(n,i),e===2&&(s=ff(n),s!==0&&(i=s,e=zf(n,s))),e===1))throw t=il,Ms(n,0),Nr(n,i),zn(n,Xt()),t;switch(n.finishedWork=r,n.finishedLanes=i,e){case 0:case 1:throw Error(le(345));case 2:ps(n,Un,tr);break;case 3:if(Nr(n,i),(i&130023424)===i&&(e=yp+500-Xt(),10<e)){if(Uc(n,0)!==0)break;if(r=n.suspendedLanes,(r&i)!==i){Rn(),n.pingedLanes|=n.suspendedLanes&r;break}n.timeoutHandle=yf(ps.bind(null,n,Un,tr),e);break}ps(n,Un,tr);break;case 4:if(Nr(n,i),(i&4194240)===i)break;for(e=n.eventTimes,r=-1;0<i;){var o=31-Ei(i);s=1<<o,o=e[o],o>r&&(r=o),i&=~s}if(i=r,i=Xt()-i,i=(120>i?120:480>i?480:1080>i?1080:1920>i?1920:3e3>i?3e3:4320>i?4320:1960*bM(i/1960))-i,10<i){n.timeoutHandle=yf(ps.bind(null,n,Un,tr),i);break}ps(n,Un,tr);break;case 5:ps(n,Un,tr);break;default:throw Error(le(329))}}}return zn(n,Xt()),n.callbackNode===t?iv.bind(null,n):null}function zf(n,e){var t=ka;return n.current.memoizedState.isDehydrated&&(Ms(n,e).flags|=256),n=Qc(n,e),n!==2&&(e=Un,Un=t,e!==null&&Hf(e)),n}function Hf(n){Un===null?Un=n:Un.push.apply(Un,n)}function AM(n){for(var e=n;;){if(e.flags&16384){var t=e.updateQueue;if(t!==null&&(t=t.stores,t!==null))for(var i=0;i<t.length;i++){var r=t[i],s=r.getSnapshot;r=r.value;try{if(!Ai(s(),r))return!1}catch{return!1}}}if(t=e.child,e.subtreeFlags&16384&&t!==null)t.return=e,e=t;else{if(e===n)break;for(;e.sibling===null;){if(e.return===null||e.return===n)return!0;e=e.return}e.sibling.return=e.return,e=e.sibling}}return!0}function Nr(n,e){for(e&=~vp,e&=~yu,n.suspendedLanes|=e,n.pingedLanes&=~e,n=n.expirationTimes;0<e;){var t=31-Ei(e),i=1<<t;n[t]=-1,e&=~i}}function hg(n){if(gt&6)throw Error(le(327));vo();var e=Uc(n,0);if(!(e&1))return zn(n,Xt()),null;var t=Qc(n,e);if(n.tag!==0&&t===2){var i=ff(n);i!==0&&(e=i,t=zf(n,i))}if(t===1)throw t=il,Ms(n,0),Nr(n,e),zn(n,Xt()),t;if(t===6)throw Error(le(345));return n.finishedWork=n.current.alternate,n.finishedLanes=e,ps(n,Un,tr),zn(n,Xt()),null}function Sp(n,e){var t=gt;gt|=1;try{return n(e)}finally{gt=t,gt===0&&(Lo=Xt()+500,gu&&Jr())}}function Rs(n){Ur!==null&&Ur.tag===0&&!(gt&6)&&vo();var e=gt;gt|=1;var t=li.transition,i=wt;try{if(li.transition=null,wt=1,n)return n()}finally{wt=i,li.transition=t,gt=e,!(gt&6)&&Jr()}}function Mp(){jn=uo.current,Dt(uo)}function Ms(n,e){n.finishedWork=null,n.finishedLanes=0;var t=n.timeoutHandle;if(t!==-1&&(n.timeoutHandle=-1,iM(t)),qt!==null)for(t=qt.return;t!==null;){var i=t;switch(np(i),i.tag){case 1:i=i.type.childContextTypes,i!=null&&zc();break;case 3:Co(),Dt(Fn),Dt(Sn),dp();break;case 5:up(i);break;case 4:Co();break;case 13:Dt(Ot);break;case 19:Dt(Ot);break;case 10:op(i.type._context);break;case 22:case 23:Mp()}t=t.return}if(sn=n,qt=n=jr(n.current,null),fn=jn=e,Qt=0,il=null,vp=yu=As=0,Un=ka=null,vs!==null){for(e=0;e<vs.length;e++)if(t=vs[e],i=t.interleaved,i!==null){t.interleaved=null;var r=i.next,s=t.pending;if(s!==null){var o=s.next;s.next=r,i.next=o}t.pending=i}vs=null}return n}function rv(n,e){do{var t=qt;try{if(sp(),_c.current=qc,Kc){for(var i=Ft.memoizedState;i!==null;){var r=i.queue;r!==null&&(r.pending=null),i=i.next}Kc=!1}if(bs=0,rn=Zt=Ft=null,Ia=!1,el=0,xp.current=null,t===null||t.return===null){Qt=1,il=e,qt=null;break}e:{var s=n,o=t.return,a=t,l=e;if(e=fn,a.flags|=32768,l!==null&&typeof l=="object"&&typeof l.then=="function"){var c=l,u=a,d=u.tag;if(!(u.mode&1)&&(d===0||d===11||d===15)){var f=u.alternate;f?(u.updateQueue=f.updateQueue,u.memoizedState=f.memoizedState,u.lanes=f.lanes):(u.updateQueue=null,u.memoizedState=null)}var p=eg(o);if(p!==null){p.flags&=-257,tg(p,o,a,s,e),p.mode&1&&Qm(s,c,e),e=p,l=c;var g=e.updateQueue;if(g===null){var v=new Set;v.add(l),e.updateQueue=v}else g.add(l);break e}else{if(!(e&1)){Qm(s,c,e),Ep();break e}l=Error(le(426))}}else if(Ut&&a.mode&1){var m=eg(o);if(m!==null){!(m.flags&65536)&&(m.flags|=256),tg(m,o,a,s,e),ip(Po(l,a));break e}}s=l=Po(l,a),Qt!==4&&(Qt=2),ka===null?ka=[s]:ka.push(s),s=o;do{switch(s.tag){case 3:s.flags|=65536,e&=-e,s.lanes|=e;var h=Hx(s,l,e);Ym(s,h);break e;case 1:a=l;var _=s.type,x=s.stateNode;if(!(s.flags&128)&&(typeof _.getDerivedStateFromError=="function"||x!==null&&typeof x.componentDidCatch=="function"&&(Gr===null||!Gr.has(x)))){s.flags|=65536,e&=-e,s.lanes|=e;var M=Vx(s,a,e);Ym(s,M);break e}}s=s.return}while(s!==null)}av(t)}catch(L){e=L,qt===t&&t!==null&&(qt=t=t.return);continue}break}while(!0)}function sv(){var n=$c.current;return $c.current=qc,n===null?qc:n}function Ep(){(Qt===0||Qt===3||Qt===2)&&(Qt=4),sn===null||!(As&268435455)&&!(yu&268435455)||Nr(sn,fn)}function Qc(n,e){var t=gt;gt|=2;var i=sv();(sn!==n||fn!==e)&&(tr=null,Ms(n,e));do try{RM();break}catch(r){rv(n,r)}while(!0);if(sp(),gt=t,$c.current=i,qt!==null)throw Error(le(261));return sn=null,fn=0,Qt}function RM(){for(;qt!==null;)ov(qt)}function CM(){for(;qt!==null&&!eS();)ov(qt)}function ov(n){var e=cv(n.alternate,n,jn);n.memoizedProps=n.pendingProps,e===null?av(n):qt=e,xp.current=null}function av(n){var e=n;do{var t=e.alternate;if(n=e.return,e.flags&32768){if(t=MM(t,e),t!==null){t.flags&=32767,qt=t;return}if(n!==null)n.flags|=32768,n.subtreeFlags=0,n.deletions=null;else{Qt=6,qt=null;return}}else if(t=SM(t,e,jn),t!==null){qt=t;return}if(e=e.sibling,e!==null){qt=e;return}qt=e=n}while(e!==null);Qt===0&&(Qt=5)}function ps(n,e,t){var i=wt,r=li.transition;try{li.transition=null,wt=1,PM(n,e,t,i)}finally{li.transition=r,wt=i}return null}function PM(n,e,t,i){do vo();while(Ur!==null);if(gt&6)throw Error(le(327));t=n.finishedWork;var r=n.finishedLanes;if(t===null)return null;if(n.finishedWork=null,n.finishedLanes=0,t===n.current)throw Error(le(177));n.callbackNode=null,n.callbackPriority=0;var s=t.lanes|t.childLanes;if(uS(n,s),n===sn&&(qt=sn=null,fn=0),!(t.subtreeFlags&2064)&&!(t.flags&2064)||Il||(Il=!0,uv(Ic,function(){return vo(),null})),s=(t.flags&15990)!==0,t.subtreeFlags&15990||s){s=li.transition,li.transition=null;var o=wt;wt=1;var a=gt;gt|=4,xp.current=null,wM(n,t),tv(t,n),$S(xf),kc=!!_f,xf=_f=null,n.current=t,TM(t),tS(),gt=a,wt=o,li.transition=s}else n.current=t;if(Il&&(Il=!1,Ur=n,Jc=r),s=n.pendingLanes,s===0&&(Gr=null),rS(t.stateNode),zn(n,Xt()),e!==null)for(i=n.onRecoverableError,t=0;t<e.length;t++)r=e[t],i(r.value,{componentStack:r.stack,digest:r.digest});if(Zc)throw Zc=!1,n=Ff,Ff=null,n;return Jc&1&&n.tag!==0&&vo(),s=n.pendingLanes,s&1?n===Bf?Oa++:(Oa=0,Bf=n):Oa=0,Jr(),null}function vo(){if(Ur!==null){var n=H_(Jc),e=li.transition,t=wt;try{if(li.transition=null,wt=16>n?16:n,Ur===null)var i=!1;else{if(n=Ur,Ur=null,Jc=0,gt&6)throw Error(le(331));var r=gt;for(gt|=4,Re=n.current;Re!==null;){var s=Re,o=s.child;if(Re.flags&16){var a=s.deletions;if(a!==null){for(var l=0;l<a.length;l++){var c=a[l];for(Re=c;Re!==null;){var u=Re;switch(u.tag){case 0:case 11:case 15:Ua(8,u,s)}var d=u.child;if(d!==null)d.return=u,Re=d;else for(;Re!==null;){u=Re;var f=u.sibling,p=u.return;if(Jx(u),u===c){Re=null;break}if(f!==null){f.return=p,Re=f;break}Re=p}}}var g=s.alternate;if(g!==null){var v=g.child;if(v!==null){g.child=null;do{var m=v.sibling;v.sibling=null,v=m}while(v!==null)}}Re=s}}if(s.subtreeFlags&2064&&o!==null)o.return=s,Re=o;else e:for(;Re!==null;){if(s=Re,s.flags&2048)switch(s.tag){case 0:case 11:case 15:Ua(9,s,s.return)}var h=s.sibling;if(h!==null){h.return=s.return,Re=h;break e}Re=s.return}}var _=n.current;for(Re=_;Re!==null;){o=Re;var x=o.child;if(o.subtreeFlags&2064&&x!==null)x.return=o,Re=x;else e:for(o=_;Re!==null;){if(a=Re,a.flags&2048)try{switch(a.tag){case 0:case 11:case 15:vu(9,a)}}catch(L){Vt(a,a.return,L)}if(a===o){Re=null;break e}var M=a.sibling;if(M!==null){M.return=a.return,Re=M;break e}Re=a.return}}if(gt=r,Jr(),Fi&&typeof Fi.onPostCommitFiberRoot=="function")try{Fi.onPostCommitFiberRoot(du,n)}catch{}i=!0}return i}finally{wt=t,li.transition=e}}return!1}function pg(n,e,t){e=Po(t,e),e=Hx(n,e,1),n=Vr(n,e,1),e=Rn(),n!==null&&(cl(n,1,e),zn(n,e))}function Vt(n,e,t){if(n.tag===3)pg(n,n,t);else for(;e!==null;){if(e.tag===3){pg(e,n,t);break}else if(e.tag===1){var i=e.stateNode;if(typeof e.type.getDerivedStateFromError=="function"||typeof i.componentDidCatch=="function"&&(Gr===null||!Gr.has(i))){n=Po(t,n),n=Vx(e,n,1),e=Vr(e,n,1),n=Rn(),e!==null&&(cl(e,1,n),zn(e,n));break}}e=e.return}}function LM(n,e,t){var i=n.pingCache;i!==null&&i.delete(e),e=Rn(),n.pingedLanes|=n.suspendedLanes&t,sn===n&&(fn&t)===t&&(Qt===4||Qt===3&&(fn&130023424)===fn&&500>Xt()-yp?Ms(n,0):vp|=t),zn(n,e)}function lv(n,e){e===0&&(n.mode&1?(e=wl,wl<<=1,!(wl&130023424)&&(wl=4194304)):e=1);var t=Rn();n=pr(n,e),n!==null&&(cl(n,e,t),zn(n,t))}function NM(n){var e=n.memoizedState,t=0;e!==null&&(t=e.retryLane),lv(n,t)}function DM(n,e){var t=0;switch(n.tag){case 13:var i=n.stateNode,r=n.memoizedState;r!==null&&(t=r.retryLane);break;case 19:i=n.stateNode;break;default:throw Error(le(314))}i!==null&&i.delete(e),lv(n,t)}var cv;cv=function(n,e,t){if(n!==null)if(n.memoizedProps!==e.pendingProps||Fn.current)On=!0;else{if(!(n.lanes&t)&&!(e.flags&128))return On=!1,yM(n,e,t);On=!!(n.flags&131072)}else On=!1,Ut&&e.flags&1048576&&hx(e,Gc,e.index);switch(e.lanes=0,e.tag){case 2:var i=e.type;vc(n,e),n=e.pendingProps;var r=bo(e,Sn.current);xo(e,t),r=hp(null,e,i,n,r,t);var s=pp();return e.flags|=1,typeof r=="object"&&r!==null&&typeof r.render=="function"&&r.$$typeof===void 0?(e.tag=1,e.memoizedState=null,e.updateQueue=null,Bn(i)?(s=!0,Hc(e)):s=!1,e.memoizedState=r.state!==null&&r.state!==void 0?r.state:null,lp(e),r.updater=xu,e.stateNode=r,r._reactInternals=e,Af(e,i,n,t),e=Pf(null,e,i,!0,s,t)):(e.tag=0,Ut&&s&&tp(e),Tn(null,e,r,t),e=e.child),e;case 16:i=e.elementType;e:{switch(vc(n,e),n=e.pendingProps,r=i._init,i=r(i._payload),e.type=i,r=e.tag=UM(i),n=_i(i,n),r){case 0:e=Cf(null,e,i,n,t);break e;case 1:e=rg(null,e,i,n,t);break e;case 11:e=ng(null,e,i,n,t);break e;case 14:e=ig(null,e,i,_i(i.type,n),t);break e}throw Error(le(306,i,""))}return e;case 0:return i=e.type,r=e.pendingProps,r=e.elementType===i?r:_i(i,r),Cf(n,e,i,r,t);case 1:return i=e.type,r=e.pendingProps,r=e.elementType===i?r:_i(i,r),rg(n,e,i,r,t);case 3:e:{if(Xx(e),n===null)throw Error(le(387));i=e.pendingProps,s=e.memoizedState,r=s.element,vx(n,e),Xc(e,i,null,t);var o=e.memoizedState;if(i=o.element,s.isDehydrated)if(s={element:i,isDehydrated:!1,cache:o.cache,pendingSuspenseBoundaries:o.pendingSuspenseBoundaries,transitions:o.transitions},e.updateQueue.baseState=s,e.memoizedState=s,e.flags&256){r=Po(Error(le(423)),e),e=sg(n,e,i,t,r);break e}else if(i!==r){r=Po(Error(le(424)),e),e=sg(n,e,i,t,r);break e}else for(Xn=Hr(e.stateNode.containerInfo.firstChild),Kn=e,Ut=!0,vi=null,t=_x(e,null,i,t),e.child=t;t;)t.flags=t.flags&-3|4096,t=t.sibling;else{if(Ao(),i===r){e=mr(n,e,t);break e}Tn(n,e,i,t)}e=e.child}return e;case 5:return yx(e),n===null&&wf(e),i=e.type,r=e.pendingProps,s=n!==null?n.memoizedProps:null,o=r.children,vf(i,r)?o=null:s!==null&&vf(i,s)&&(e.flags|=32),jx(n,e),Tn(n,e,o,t),e.child;case 6:return n===null&&wf(e),null;case 13:return Yx(n,e,t);case 4:return cp(e,e.stateNode.containerInfo),i=e.pendingProps,n===null?e.child=Ro(e,null,i,t):Tn(n,e,i,t),e.child;case 11:return i=e.type,r=e.pendingProps,r=e.elementType===i?r:_i(i,r),ng(n,e,i,r,t);case 7:return Tn(n,e,e.pendingProps,t),e.child;case 8:return Tn(n,e,e.pendingProps.children,t),e.child;case 12:return Tn(n,e,e.pendingProps.children,t),e.child;case 10:e:{if(i=e.type._context,r=e.pendingProps,s=e.memoizedProps,o=r.value,Ct(Wc,i._currentValue),i._currentValue=o,s!==null)if(Ai(s.value,o)){if(s.children===r.children&&!Fn.current){e=mr(n,e,t);break e}}else for(s=e.child,s!==null&&(s.return=e);s!==null;){var a=s.dependencies;if(a!==null){o=s.child;for(var l=a.firstContext;l!==null;){if(l.context===i){if(s.tag===1){l=ur(-1,t&-t),l.tag=2;var c=s.updateQueue;if(c!==null){c=c.shared;var u=c.pending;u===null?l.next=l:(l.next=u.next,u.next=l),c.pending=l}}s.lanes|=t,l=s.alternate,l!==null&&(l.lanes|=t),Tf(s.return,t,e),a.lanes|=t;break}l=l.next}}else if(s.tag===10)o=s.type===e.type?null:s.child;else if(s.tag===18){if(o=s.return,o===null)throw Error(le(341));o.lanes|=t,a=o.alternate,a!==null&&(a.lanes|=t),Tf(o,t,e),o=s.sibling}else o=s.child;if(o!==null)o.return=s;else for(o=s;o!==null;){if(o===e){o=null;break}if(s=o.sibling,s!==null){s.return=o.return,o=s;break}o=o.return}s=o}Tn(n,e,r.children,t),e=e.child}return e;case 9:return r=e.type,i=e.pendingProps.children,xo(e,t),r=ci(r),i=i(r),e.flags|=1,Tn(n,e,i,t),e.child;case 14:return i=e.type,r=_i(i,e.pendingProps),r=_i(i.type,r),ig(n,e,i,r,t);case 15:return Gx(n,e,e.type,e.pendingProps,t);case 17:return i=e.type,r=e.pendingProps,r=e.elementType===i?r:_i(i,r),vc(n,e),e.tag=1,Bn(i)?(n=!0,Hc(e)):n=!1,xo(e,t),zx(e,i,r),Af(e,i,r,t),Pf(null,e,i,!0,n,t);case 19:return Kx(n,e,t);case 22:return Wx(n,e,t)}throw Error(le(156,e.tag))};function uv(n,e){return O_(n,e)}function IM(n,e,t,i){this.tag=n,this.key=t,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.ref=null,this.pendingProps=e,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=i,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function oi(n,e,t,i){return new IM(n,e,t,i)}function wp(n){return n=n.prototype,!(!n||!n.isReactComponent)}function UM(n){if(typeof n=="function")return wp(n)?1:0;if(n!=null){if(n=n.$$typeof,n===Gh)return 11;if(n===Wh)return 14}return 2}function jr(n,e){var t=n.alternate;return t===null?(t=oi(n.tag,e,n.key,n.mode),t.elementType=n.elementType,t.type=n.type,t.stateNode=n.stateNode,t.alternate=n,n.alternate=t):(t.pendingProps=e,t.type=n.type,t.flags=0,t.subtreeFlags=0,t.deletions=null),t.flags=n.flags&14680064,t.childLanes=n.childLanes,t.lanes=n.lanes,t.child=n.child,t.memoizedProps=n.memoizedProps,t.memoizedState=n.memoizedState,t.updateQueue=n.updateQueue,e=n.dependencies,t.dependencies=e===null?null:{lanes:e.lanes,firstContext:e.firstContext},t.sibling=n.sibling,t.index=n.index,t.ref=n.ref,t}function Mc(n,e,t,i,r,s){var o=2;if(i=n,typeof n=="function")wp(n)&&(o=1);else if(typeof n=="string")o=5;else e:switch(n){case eo:return Es(t.children,r,s,e);case Vh:o=8,r|=8;break;case $d:return n=oi(12,t,e,r|2),n.elementType=$d,n.lanes=s,n;case Zd:return n=oi(13,t,e,r),n.elementType=Zd,n.lanes=s,n;case Jd:return n=oi(19,t,e,r),n.elementType=Jd,n.lanes=s,n;case y_:return Su(t,r,s,e);default:if(typeof n=="object"&&n!==null)switch(n.$$typeof){case x_:o=10;break e;case v_:o=9;break e;case Gh:o=11;break e;case Wh:o=14;break e;case Cr:o=16,i=null;break e}throw Error(le(130,n==null?n:typeof n,""))}return e=oi(o,t,e,r),e.elementType=n,e.type=i,e.lanes=s,e}function Es(n,e,t,i){return n=oi(7,n,i,e),n.lanes=t,n}function Su(n,e,t,i){return n=oi(22,n,i,e),n.elementType=y_,n.lanes=t,n.stateNode={isHidden:!1},n}function id(n,e,t){return n=oi(6,n,null,e),n.lanes=t,n}function rd(n,e,t){return e=oi(4,n.children!==null?n.children:[],n.key,e),e.lanes=t,e.stateNode={containerInfo:n.containerInfo,pendingChildren:null,implementation:n.implementation},e}function kM(n,e,t,i,r){this.tag=e,this.containerInfo=n,this.finishedWork=this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.pendingContext=this.context=null,this.callbackPriority=0,this.eventTimes=Fu(0),this.expirationTimes=Fu(-1),this.entangledLanes=this.finishedLanes=this.mutableReadLanes=this.expiredLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=Fu(0),this.identifierPrefix=i,this.onRecoverableError=r,this.mutableSourceEagerHydrationData=null}function Tp(n,e,t,i,r,s,o,a,l){return n=new kM(n,e,t,a,l),e===1?(e=1,s===!0&&(e|=8)):e=0,s=oi(3,null,null,e),n.current=s,s.stateNode=n,s.memoizedState={element:i,isDehydrated:t,cache:null,transitions:null,pendingSuspenseBoundaries:null},lp(s),n}function OM(n,e,t){var i=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:Qs,key:i==null?null:""+i,children:n,containerInfo:e,implementation:t}}function dv(n){if(!n)return Kr;n=n._reactInternals;e:{if(Ns(n)!==n||n.tag!==1)throw Error(le(170));var e=n;do{switch(e.tag){case 3:e=e.stateNode.context;break e;case 1:if(Bn(e.type)){e=e.stateNode.__reactInternalMemoizedMergedChildContext;break e}}e=e.return}while(e!==null);throw Error(le(171))}if(n.tag===1){var t=n.type;if(Bn(t))return dx(n,t,e)}return e}function fv(n,e,t,i,r,s,o,a,l){return n=Tp(t,i,!0,n,r,s,o,a,l),n.context=dv(null),t=n.current,i=Rn(),r=Wr(t),s=ur(i,r),s.callback=e??null,Vr(t,s,r),n.current.lanes=r,cl(n,r,i),zn(n,i),n}function Mu(n,e,t,i){var r=e.current,s=Rn(),o=Wr(r);return t=dv(t),e.context===null?e.context=t:e.pendingContext=t,e=ur(s,o),e.payload={element:n},i=i===void 0?null:i,i!==null&&(e.callback=i),n=Vr(r,e,o),n!==null&&(wi(n,r,o,s),gc(n,r,o)),o}function eu(n){if(n=n.current,!n.child)return null;switch(n.child.tag){case 5:return n.child.stateNode;default:return n.child.stateNode}}function mg(n,e){if(n=n.memoizedState,n!==null&&n.dehydrated!==null){var t=n.retryLane;n.retryLane=t!==0&&t<e?t:e}}function bp(n,e){mg(n,e),(n=n.alternate)&&mg(n,e)}function FM(){return null}var hv=typeof reportError=="function"?reportError:function(n){console.error(n)};function Ap(n){this._internalRoot=n}Eu.prototype.render=Ap.prototype.render=function(n){var e=this._internalRoot;if(e===null)throw Error(le(409));Mu(n,e,null,null)};Eu.prototype.unmount=Ap.prototype.unmount=function(){var n=this._internalRoot;if(n!==null){this._internalRoot=null;var e=n.containerInfo;Rs(function(){Mu(null,n,null,null)}),e[hr]=null}};function Eu(n){this._internalRoot=n}Eu.prototype.unstable_scheduleHydration=function(n){if(n){var e=W_();n={blockedOn:null,target:n,priority:e};for(var t=0;t<Lr.length&&e!==0&&e<Lr[t].priority;t++);Lr.splice(t,0,n),t===0&&X_(n)}};function Rp(n){return!(!n||n.nodeType!==1&&n.nodeType!==9&&n.nodeType!==11)}function wu(n){return!(!n||n.nodeType!==1&&n.nodeType!==9&&n.nodeType!==11&&(n.nodeType!==8||n.nodeValue!==" react-mount-point-unstable "))}function gg(){}function BM(n,e,t,i,r){if(r){if(typeof i=="function"){var s=i;i=function(){var c=eu(o);s.call(c)}}var o=fv(e,i,n,0,null,!1,!1,"",gg);return n._reactRootContainer=o,n[hr]=o.current,qa(n.nodeType===8?n.parentNode:n),Rs(),o}for(;r=n.lastChild;)n.removeChild(r);if(typeof i=="function"){var a=i;i=function(){var c=eu(l);a.call(c)}}var l=Tp(n,0,!1,null,null,!1,!1,"",gg);return n._reactRootContainer=l,n[hr]=l.current,qa(n.nodeType===8?n.parentNode:n),Rs(function(){Mu(e,l,t,i)}),l}function Tu(n,e,t,i,r){var s=t._reactRootContainer;if(s){var o=s;if(typeof r=="function"){var a=r;r=function(){var l=eu(o);a.call(l)}}Mu(e,o,n,r)}else o=BM(t,e,n,r,i);return eu(o)}V_=function(n){switch(n.tag){case 3:var e=n.stateNode;if(e.current.memoizedState.isDehydrated){var t=Ta(e.pendingLanes);t!==0&&(Yh(e,t|1),zn(e,Xt()),!(gt&6)&&(Lo=Xt()+500,Jr()))}break;case 13:Rs(function(){var i=pr(n,1);if(i!==null){var r=Rn();wi(i,n,1,r)}}),bp(n,1)}};Kh=function(n){if(n.tag===13){var e=pr(n,134217728);if(e!==null){var t=Rn();wi(e,n,134217728,t)}bp(n,134217728)}};G_=function(n){if(n.tag===13){var e=Wr(n),t=pr(n,e);if(t!==null){var i=Rn();wi(t,n,e,i)}bp(n,e)}};W_=function(){return wt};j_=function(n,e){var t=wt;try{return wt=n,e()}finally{wt=t}};cf=function(n,e,t){switch(e){case"input":if(tf(n,t),e=t.name,t.type==="radio"&&e!=null){for(t=n;t.parentNode;)t=t.parentNode;for(t=t.querySelectorAll("input[name="+JSON.stringify(""+e)+'][type="radio"]'),e=0;e<t.length;e++){var i=t[e];if(i!==n&&i.form===n.form){var r=mu(i);if(!r)throw Error(le(90));M_(i),tf(i,r)}}}break;case"textarea":w_(n,t);break;case"select":e=t.value,e!=null&&po(n,!!t.multiple,e,!1)}};L_=Sp;N_=Rs;var zM={usingClientEntryPoint:!1,Events:[dl,ro,mu,C_,P_,Sp]},ca={findFiberByHostInstance:xs,bundleType:0,version:"18.3.1",rendererPackageName:"react-dom"},HM={bundleType:ca.bundleType,version:ca.version,rendererPackageName:ca.rendererPackageName,rendererConfig:ca.rendererConfig,overrideHookState:null,overrideHookStateDeletePath:null,overrideHookStateRenamePath:null,overrideProps:null,overridePropsDeletePath:null,overridePropsRenamePath:null,setErrorHandler:null,setSuspenseHandler:null,scheduleUpdate:null,currentDispatcherRef:_r.ReactCurrentDispatcher,findHostInstanceByFiber:function(n){return n=U_(n),n===null?null:n.stateNode},findFiberByHostInstance:ca.findFiberByHostInstance||FM,findHostInstancesForRefresh:null,scheduleRefresh:null,scheduleRoot:null,setRefreshHandler:null,getCurrentFiber:null,reconcilerVersion:"18.3.1-next-f1338f8080-20240426"};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<"u"){var Ul=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!Ul.isDisabled&&Ul.supportsFiber)try{du=Ul.inject(HM),Fi=Ul}catch{}}$n.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=zM;$n.createPortal=function(n,e){var t=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!Rp(e))throw Error(le(200));return OM(n,e,null,t)};$n.createRoot=function(n,e){if(!Rp(n))throw Error(le(299));var t=!1,i="",r=hv;return e!=null&&(e.unstable_strictMode===!0&&(t=!0),e.identifierPrefix!==void 0&&(i=e.identifierPrefix),e.onRecoverableError!==void 0&&(r=e.onRecoverableError)),e=Tp(n,1,!1,null,null,t,!1,i,r),n[hr]=e.current,qa(n.nodeType===8?n.parentNode:n),new Ap(e)};$n.findDOMNode=function(n){if(n==null)return null;if(n.nodeType===1)return n;var e=n._reactInternals;if(e===void 0)throw typeof n.render=="function"?Error(le(188)):(n=Object.keys(n).join(","),Error(le(268,n)));return n=U_(e),n=n===null?null:n.stateNode,n};$n.flushSync=function(n){return Rs(n)};$n.hydrate=function(n,e,t){if(!wu(e))throw Error(le(200));return Tu(null,n,e,!0,t)};$n.hydrateRoot=function(n,e,t){if(!Rp(n))throw Error(le(405));var i=t!=null&&t.hydratedSources||null,r=!1,s="",o=hv;if(t!=null&&(t.unstable_strictMode===!0&&(r=!0),t.identifierPrefix!==void 0&&(s=t.identifierPrefix),t.onRecoverableError!==void 0&&(o=t.onRecoverableError)),e=fv(e,null,n,1,t??null,r,!1,s,o),n[hr]=e.current,qa(n),i)for(n=0;n<i.length;n++)t=i[n],r=t._getVersion,r=r(t._source),e.mutableSourceEagerHydrationData==null?e.mutableSourceEagerHydrationData=[t,r]:e.mutableSourceEagerHydrationData.push(t,r);return new Eu(e)};$n.render=function(n,e,t){if(!wu(e))throw Error(le(200));return Tu(null,n,e,!1,t)};$n.unmountComponentAtNode=function(n){if(!wu(n))throw Error(le(40));return n._reactRootContainer?(Rs(function(){Tu(null,null,n,!1,function(){n._reactRootContainer=null,n[hr]=null})}),!0):!1};$n.unstable_batchedUpdates=Sp;$n.unstable_renderSubtreeIntoContainer=function(n,e,t,i){if(!wu(t))throw Error(le(200));if(n==null||n._reactInternals===void 0)throw Error(le(38));return Tu(n,e,t,!1,i)};$n.version="18.3.1-next-f1338f8080-20240426";function pv(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(pv)}catch(n){console.error(n)}}pv(),p_.exports=$n;var VM=p_.exports,_g=VM;Kd.createRoot=_g.createRoot,Kd.hydrateRoot=_g.hydrateRoot;/**
 * @license
 * Copyright 2010-2024 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const Cp="169",yo={ROTATE:0,DOLLY:1,PAN:2},fo={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},GM=0,xg=1,WM=2,mv=1,jM=2,er=3,Hi=0,Hn=1,ki=2,Xr=0,So=1,vg=2,yg=3,Sg=4,XM=5,gs=100,YM=101,KM=102,qM=103,$M=104,ZM=200,JM=201,QM=202,eE=203,Vf=204,Gf=205,tE=206,nE=207,iE=208,rE=209,sE=210,oE=211,aE=212,lE=213,cE=214,Wf=0,jf=1,Xf=2,No=3,Yf=4,Kf=5,qf=6,$f=7,gv=0,uE=1,dE=2,dr=0,fE=1,hE=2,pE=3,mE=4,gE=5,_E=6,xE=7,Mg="attached",vE="detached",_v=300,Do=301,Io=302,Zf=303,Jf=304,bu=306,Uo=1e3,kr=1001,tu=1002,An=1003,xv=1004,Aa=1005,kn=1006,Ec=1007,Oi=1008,gr=1009,vv=1010,yv=1011,rl=1012,Pp=1013,Cs=1014,Mi=1015,hl=1016,Lp=1017,Np=1018,ko=1020,Sv=35902,Mv=1021,Ev=1022,ai=1023,wv=1024,Tv=1025,Mo=1026,Oo=1027,Dp=1028,Ip=1029,bv=1030,Up=1031,kp=1033,wc=33776,Tc=33777,bc=33778,Ac=33779,Qf=35840,eh=35841,th=35842,nh=35843,ih=36196,rh=37492,sh=37496,oh=37808,ah=37809,lh=37810,ch=37811,uh=37812,dh=37813,fh=37814,hh=37815,ph=37816,mh=37817,gh=37818,_h=37819,xh=37820,vh=37821,Rc=36492,yh=36494,Sh=36495,Av=36283,Mh=36284,Eh=36285,wh=36286,sl=2300,ol=2301,sd=2302,Eg=2400,wg=2401,Tg=2402,yE=2500,SE=0,Rv=1,Th=2,ME=3200,EE=3201,Cv=0,wE=1,Dr="",Jt="srgb",an="srgb-linear",Op="display-p3",Au="display-p3-linear",nu="linear",Nt="srgb",iu="rec709",ru="p3",Fs=7680,bg=519,TE=512,bE=513,AE=514,Pv=515,RE=516,CE=517,PE=518,LE=519,bh=35044,Ag="300 es",lr=2e3,su=2001;class Ds{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const i=this._listeners;i[e]===void 0&&(i[e]=[]),i[e].indexOf(t)===-1&&i[e].push(t)}hasEventListener(e,t){if(this._listeners===void 0)return!1;const i=this._listeners;return i[e]!==void 0&&i[e].indexOf(t)!==-1}removeEventListener(e,t){if(this._listeners===void 0)return;const r=this._listeners[e];if(r!==void 0){const s=r.indexOf(t);s!==-1&&r.splice(s,1)}}dispatchEvent(e){if(this._listeners===void 0)return;const i=this._listeners[e.type];if(i!==void 0){e.target=this;const r=i.slice(0);for(let s=0,o=r.length;s<o;s++)r[s].call(this,e);e.target=null}}}const xn=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let Rg=1234567;const Fa=Math.PI/180,Fo=180/Math.PI;function Ti(){const n=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(xn[n&255]+xn[n>>8&255]+xn[n>>16&255]+xn[n>>24&255]+"-"+xn[e&255]+xn[e>>8&255]+"-"+xn[e>>16&15|64]+xn[e>>24&255]+"-"+xn[t&63|128]+xn[t>>8&255]+"-"+xn[t>>16&255]+xn[t>>24&255]+xn[i&255]+xn[i>>8&255]+xn[i>>16&255]+xn[i>>24&255]).toLowerCase()}function dn(n,e,t){return Math.max(e,Math.min(t,n))}function Fp(n,e){return(n%e+e)%e}function NE(n,e,t,i,r){return i+(n-e)*(r-i)/(t-e)}function DE(n,e,t){return n!==e?(t-n)/(e-n):0}function Ba(n,e,t){return(1-t)*n+t*e}function IE(n,e,t,i){return Ba(n,e,1-Math.exp(-t*i))}function UE(n,e=1){return e-Math.abs(Fp(n,e*2)-e)}function kE(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*(3-2*n))}function OE(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*n*(n*(n*6-15)+10))}function FE(n,e){return n+Math.floor(Math.random()*(e-n+1))}function BE(n,e){return n+Math.random()*(e-n)}function zE(n){return n*(.5-Math.random())}function HE(n){n!==void 0&&(Rg=n);let e=Rg+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function VE(n){return n*Fa}function GE(n){return n*Fo}function WE(n){return(n&n-1)===0&&n!==0}function jE(n){return Math.pow(2,Math.ceil(Math.log(n)/Math.LN2))}function XE(n){return Math.pow(2,Math.floor(Math.log(n)/Math.LN2))}function YE(n,e,t,i,r){const s=Math.cos,o=Math.sin,a=s(t/2),l=o(t/2),c=s((e+i)/2),u=o((e+i)/2),d=s((e-i)/2),f=o((e-i)/2),p=s((i-e)/2),g=o((i-e)/2);switch(r){case"XYX":n.set(a*u,l*d,l*f,a*c);break;case"YZY":n.set(l*f,a*u,l*d,a*c);break;case"ZXZ":n.set(l*d,l*f,a*u,a*c);break;case"XZX":n.set(a*u,l*g,l*p,a*c);break;case"YXY":n.set(l*p,a*u,l*g,a*c);break;case"ZYZ":n.set(l*g,l*p,a*u,a*c);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+r)}}function yi(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return n/4294967295;case Uint16Array:return n/65535;case Uint8Array:return n/255;case Int32Array:return Math.max(n/2147483647,-1);case Int16Array:return Math.max(n/32767,-1);case Int8Array:return Math.max(n/127,-1);default:throw new Error("Invalid component type.")}}function Mt(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return Math.round(n*4294967295);case Uint16Array:return Math.round(n*65535);case Uint8Array:return Math.round(n*255);case Int32Array:return Math.round(n*2147483647);case Int16Array:return Math.round(n*32767);case Int8Array:return Math.round(n*127);default:throw new Error("Invalid component type.")}}const Lv={DEG2RAD:Fa,RAD2DEG:Fo,generateUUID:Ti,clamp:dn,euclideanModulo:Fp,mapLinear:NE,inverseLerp:DE,lerp:Ba,damp:IE,pingpong:UE,smoothstep:kE,smootherstep:OE,randInt:FE,randFloat:BE,randFloatSpread:zE,seededRandom:HE,degToRad:VE,radToDeg:GE,isPowerOfTwo:WE,ceilPowerOfTwo:jE,floorPowerOfTwo:XE,setQuaternionFromProperEuler:YE,normalize:Mt,denormalize:yi};class He{constructor(e=0,t=0){He.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,i=this.y,r=e.elements;return this.x=r[0]*t+r[3]*i+r[6],this.y=r[1]*t+r[4]*i+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this}clampLength(e,t){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(e,Math.min(t,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const i=this.dot(e)/t;return Math.acos(dn(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,i=this.y-e.y;return t*t+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const i=Math.cos(t),r=Math.sin(t),s=this.x-e.x,o=this.y-e.y;return this.x=s*i-o*r+e.x,this.y=s*r+o*i+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class nt{constructor(e,t,i,r,s,o,a,l,c){nt.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,i,r,s,o,a,l,c)}set(e,t,i,r,s,o,a,l,c){const u=this.elements;return u[0]=e,u[1]=r,u[2]=a,u[3]=t,u[4]=s,u[5]=l,u[6]=i,u[7]=o,u[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],this}extractBasis(e,t,i){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const i=e.elements,r=t.elements,s=this.elements,o=i[0],a=i[3],l=i[6],c=i[1],u=i[4],d=i[7],f=i[2],p=i[5],g=i[8],v=r[0],m=r[3],h=r[6],_=r[1],x=r[4],M=r[7],L=r[2],A=r[5],T=r[8];return s[0]=o*v+a*_+l*L,s[3]=o*m+a*x+l*A,s[6]=o*h+a*M+l*T,s[1]=c*v+u*_+d*L,s[4]=c*m+u*x+d*A,s[7]=c*h+u*M+d*T,s[2]=f*v+p*_+g*L,s[5]=f*m+p*x+g*A,s[8]=f*h+p*M+g*T,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],u=e[8];return t*o*u-t*a*c-i*s*u+i*a*l+r*s*c-r*o*l}invert(){const e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],u=e[8],d=u*o-a*c,f=a*l-u*s,p=c*s-o*l,g=t*d+i*f+r*p;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const v=1/g;return e[0]=d*v,e[1]=(r*c-u*i)*v,e[2]=(a*i-r*o)*v,e[3]=f*v,e[4]=(u*t-r*l)*v,e[5]=(r*s-a*t)*v,e[6]=p*v,e[7]=(i*l-c*t)*v,e[8]=(o*t-i*s)*v,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,i,r,s,o,a){const l=Math.cos(s),c=Math.sin(s);return this.set(i*l,i*c,-i*(l*o+c*a)+o+e,-r*c,r*l,-r*(-c*o+l*a)+a+t,0,0,1),this}scale(e,t){return this.premultiply(od.makeScale(e,t)),this}rotate(e){return this.premultiply(od.makeRotation(-e)),this}translate(e,t){return this.premultiply(od.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,i,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,i=e.elements;for(let r=0;r<9;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<9;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){const i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e}clone(){return new this.constructor().fromArray(this.elements)}}const od=new nt;function Nv(n){for(let e=n.length-1;e>=0;--e)if(n[e]>=65535)return!0;return!1}function al(n){return document.createElementNS("http://www.w3.org/1999/xhtml",n)}function KE(){const n=al("canvas");return n.style.display="block",n}const Cg={};function Cc(n){n in Cg||(Cg[n]=!0,console.warn(n))}function qE(n,e,t){return new Promise(function(i,r){function s(){switch(n.clientWaitSync(e,n.SYNC_FLUSH_COMMANDS_BIT,0)){case n.WAIT_FAILED:r();break;case n.TIMEOUT_EXPIRED:setTimeout(s,t);break;default:i()}}setTimeout(s,t)})}function $E(n){const e=n.elements;e[2]=.5*e[2]+.5*e[3],e[6]=.5*e[6]+.5*e[7],e[10]=.5*e[10]+.5*e[11],e[14]=.5*e[14]+.5*e[15]}function ZE(n){const e=n.elements;e[11]===-1?(e[10]=-e[10]-1,e[14]=-e[14]):(e[10]=-e[10],e[14]=-e[14]+1)}const Pg=new nt().set(.8224621,.177538,0,.0331941,.9668058,0,.0170827,.0723974,.9105199),Lg=new nt().set(1.2249401,-.2249404,0,-.0420569,1.0420571,0,-.0196376,-.0786361,1.0982735),ua={[an]:{transfer:nu,primaries:iu,luminanceCoefficients:[.2126,.7152,.0722],toReference:n=>n,fromReference:n=>n},[Jt]:{transfer:Nt,primaries:iu,luminanceCoefficients:[.2126,.7152,.0722],toReference:n=>n.convertSRGBToLinear(),fromReference:n=>n.convertLinearToSRGB()},[Au]:{transfer:nu,primaries:ru,luminanceCoefficients:[.2289,.6917,.0793],toReference:n=>n.applyMatrix3(Lg),fromReference:n=>n.applyMatrix3(Pg)},[Op]:{transfer:Nt,primaries:ru,luminanceCoefficients:[.2289,.6917,.0793],toReference:n=>n.convertSRGBToLinear().applyMatrix3(Lg),fromReference:n=>n.applyMatrix3(Pg).convertLinearToSRGB()}},JE=new Set([an,Au]),mt={enabled:!0,_workingColorSpace:an,get workingColorSpace(){return this._workingColorSpace},set workingColorSpace(n){if(!JE.has(n))throw new Error(`Unsupported working color space, "${n}".`);this._workingColorSpace=n},convert:function(n,e,t){if(this.enabled===!1||e===t||!e||!t)return n;const i=ua[e].toReference,r=ua[t].fromReference;return r(i(n))},fromWorkingColorSpace:function(n,e){return this.convert(n,this._workingColorSpace,e)},toWorkingColorSpace:function(n,e){return this.convert(n,e,this._workingColorSpace)},getPrimaries:function(n){return ua[n].primaries},getTransfer:function(n){return n===Dr?nu:ua[n].transfer},getLuminanceCoefficients:function(n,e=this._workingColorSpace){return n.fromArray(ua[e].luminanceCoefficients)}};function Eo(n){return n<.04045?n*.0773993808:Math.pow(n*.9478672986+.0521327014,2.4)}function ad(n){return n<.0031308?n*12.92:1.055*Math.pow(n,.41666)-.055}let Bs;class QE{static getDataURL(e){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let t;if(e instanceof HTMLCanvasElement)t=e;else{Bs===void 0&&(Bs=al("canvas")),Bs.width=e.width,Bs.height=e.height;const i=Bs.getContext("2d");e instanceof ImageData?i.putImageData(e,0,0):i.drawImage(e,0,0,e.width,e.height),t=Bs}return t.width>2048||t.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",e),t.toDataURL("image/jpeg",.6)):t.toDataURL("image/png")}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=al("canvas");t.width=e.width,t.height=e.height;const i=t.getContext("2d");i.drawImage(e,0,0,e.width,e.height);const r=i.getImageData(0,0,e.width,e.height),s=r.data;for(let o=0;o<s.length;o++)s[o]=Eo(s[o]/255)*255;return i.putImageData(r,0,0),t}else if(e.data){const t=e.data.slice(0);for(let i=0;i<t.length;i++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[i]=Math.floor(Eo(t[i]/255)*255):t[i]=Eo(t[i]);return{data:t,width:e.width,height:e.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let e1=0;class Dv{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:e1++}),this.uuid=Ti(),this.data=e,this.dataReady=!0,this.version=0}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const i={uuid:this.uuid,url:""},r=this.data;if(r!==null){let s;if(Array.isArray(r)){s=[];for(let o=0,a=r.length;o<a;o++)r[o].isDataTexture?s.push(ld(r[o].image)):s.push(ld(r[o]))}else s=ld(r);i.url=s}return t||(e.images[this.uuid]=i),i}}function ld(n){return typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&n instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&n instanceof ImageBitmap?QE.getDataURL(n):n.data?{data:Array.from(n.data),width:n.width,height:n.height,type:n.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let t1=0;class on extends Ds{constructor(e=on.DEFAULT_IMAGE,t=on.DEFAULT_MAPPING,i=kr,r=kr,s=kn,o=Oi,a=ai,l=gr,c=on.DEFAULT_ANISOTROPY,u=Dr){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:t1++}),this.uuid=Ti(),this.name="",this.source=new Dv(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=i,this.wrapT=r,this.magFilter=s,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new He(0,0),this.repeat=new He(1,1),this.center=new He(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new nt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=u,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const i={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),t||(e.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==_v)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Uo:e.x=e.x-Math.floor(e.x);break;case kr:e.x=e.x<0?0:1;break;case tu:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Uo:e.y=e.y-Math.floor(e.y);break;case kr:e.y=e.y<0?0:1;break;case tu:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}}on.DEFAULT_IMAGE=null;on.DEFAULT_MAPPING=_v;on.DEFAULT_ANISOTROPY=1;class yt{constructor(e=0,t=0,i=0,r=1){yt.prototype.isVector4=!0,this.x=e,this.y=t,this.z=i,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,i,r){return this.x=e,this.y=t,this.z=i,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,i=this.y,r=this.z,s=this.w,o=e.elements;return this.x=o[0]*t+o[4]*i+o[8]*r+o[12]*s,this.y=o[1]*t+o[5]*i+o[9]*r+o[13]*s,this.z=o[2]*t+o[6]*i+o[10]*r+o[14]*s,this.w=o[3]*t+o[7]*i+o[11]*r+o[15]*s,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,i,r,s;const l=e.elements,c=l[0],u=l[4],d=l[8],f=l[1],p=l[5],g=l[9],v=l[2],m=l[6],h=l[10];if(Math.abs(u-f)<.01&&Math.abs(d-v)<.01&&Math.abs(g-m)<.01){if(Math.abs(u+f)<.1&&Math.abs(d+v)<.1&&Math.abs(g+m)<.1&&Math.abs(c+p+h-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const x=(c+1)/2,M=(p+1)/2,L=(h+1)/2,A=(u+f)/4,T=(d+v)/4,I=(g+m)/4;return x>M&&x>L?x<.01?(i=0,r=.707106781,s=.707106781):(i=Math.sqrt(x),r=A/i,s=T/i):M>L?M<.01?(i=.707106781,r=0,s=.707106781):(r=Math.sqrt(M),i=A/r,s=I/r):L<.01?(i=.707106781,r=.707106781,s=0):(s=Math.sqrt(L),i=T/s,r=I/s),this.set(i,r,s,t),this}let _=Math.sqrt((m-g)*(m-g)+(d-v)*(d-v)+(f-u)*(f-u));return Math.abs(_)<.001&&(_=1),this.x=(m-g)/_,this.y=(d-v)/_,this.z=(f-u)/_,this.w=Math.acos((c+p+h-1)/2),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this.w=Math.max(e.w,Math.min(t.w,this.w)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this.w=Math.max(e,Math.min(t,this.w)),this}clampLength(e,t){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(e,Math.min(t,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this.w=e.w+(t.w-e.w)*i,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class n1 extends Ds{constructor(e=1,t=1,i={}){super(),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=1,this.scissor=new yt(0,0,e,t),this.scissorTest=!1,this.viewport=new yt(0,0,e,t);const r={width:e,height:t,depth:1};i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:kn,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},i);const s=new on(r,i.mapping,i.wrapS,i.wrapT,i.magFilter,i.minFilter,i.format,i.type,i.anisotropy,i.colorSpace);s.flipY=!1,s.generateMipmaps=i.generateMipmaps,s.internalFormat=i.internalFormat,this.textures=[];const o=i.count;for(let a=0;a<o;a++)this.textures[a]=s.clone(),this.textures[a].isRenderTargetTexture=!0;this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this.depthTexture=i.depthTexture,this.samples=i.samples}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}setSize(e,t,i=1){if(this.width!==e||this.height!==t||this.depth!==i){this.width=e,this.height=t,this.depth=i;for(let r=0,s=this.textures.length;r<s;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=i;this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let i=0,r=e.textures.length;i<r;i++)this.textures[i]=e.textures[i].clone(),this.textures[i].isRenderTargetTexture=!0;const t=Object.assign({},e.texture.image);return this.texture.source=new Dv(t),this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Ps extends n1{constructor(e=1,t=1,i={}){super(e,t,i),this.isWebGLRenderTarget=!0}}class Iv extends on{constructor(e=null,t=1,i=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=An,this.minFilter=An,this.wrapR=kr,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class i1 extends on{constructor(e=null,t=1,i=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=An,this.minFilter=An,this.wrapR=kr,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Vi{constructor(e=0,t=0,i=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=i,this._w=r}static slerpFlat(e,t,i,r,s,o,a){let l=i[r+0],c=i[r+1],u=i[r+2],d=i[r+3];const f=s[o+0],p=s[o+1],g=s[o+2],v=s[o+3];if(a===0){e[t+0]=l,e[t+1]=c,e[t+2]=u,e[t+3]=d;return}if(a===1){e[t+0]=f,e[t+1]=p,e[t+2]=g,e[t+3]=v;return}if(d!==v||l!==f||c!==p||u!==g){let m=1-a;const h=l*f+c*p+u*g+d*v,_=h>=0?1:-1,x=1-h*h;if(x>Number.EPSILON){const L=Math.sqrt(x),A=Math.atan2(L,h*_);m=Math.sin(m*A)/L,a=Math.sin(a*A)/L}const M=a*_;if(l=l*m+f*M,c=c*m+p*M,u=u*m+g*M,d=d*m+v*M,m===1-a){const L=1/Math.sqrt(l*l+c*c+u*u+d*d);l*=L,c*=L,u*=L,d*=L}}e[t]=l,e[t+1]=c,e[t+2]=u,e[t+3]=d}static multiplyQuaternionsFlat(e,t,i,r,s,o){const a=i[r],l=i[r+1],c=i[r+2],u=i[r+3],d=s[o],f=s[o+1],p=s[o+2],g=s[o+3];return e[t]=a*g+u*d+l*p-c*f,e[t+1]=l*g+u*f+c*d-a*p,e[t+2]=c*g+u*p+a*f-l*d,e[t+3]=u*g-a*d-l*f-c*p,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,i,r){return this._x=e,this._y=t,this._z=i,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const i=e._x,r=e._y,s=e._z,o=e._order,a=Math.cos,l=Math.sin,c=a(i/2),u=a(r/2),d=a(s/2),f=l(i/2),p=l(r/2),g=l(s/2);switch(o){case"XYZ":this._x=f*u*d+c*p*g,this._y=c*p*d-f*u*g,this._z=c*u*g+f*p*d,this._w=c*u*d-f*p*g;break;case"YXZ":this._x=f*u*d+c*p*g,this._y=c*p*d-f*u*g,this._z=c*u*g-f*p*d,this._w=c*u*d+f*p*g;break;case"ZXY":this._x=f*u*d-c*p*g,this._y=c*p*d+f*u*g,this._z=c*u*g+f*p*d,this._w=c*u*d-f*p*g;break;case"ZYX":this._x=f*u*d-c*p*g,this._y=c*p*d+f*u*g,this._z=c*u*g-f*p*d,this._w=c*u*d+f*p*g;break;case"YZX":this._x=f*u*d+c*p*g,this._y=c*p*d+f*u*g,this._z=c*u*g-f*p*d,this._w=c*u*d-f*p*g;break;case"XZY":this._x=f*u*d-c*p*g,this._y=c*p*d-f*u*g,this._z=c*u*g+f*p*d,this._w=c*u*d+f*p*g;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+o)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const i=t/2,r=Math.sin(i);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,i=t[0],r=t[4],s=t[8],o=t[1],a=t[5],l=t[9],c=t[2],u=t[6],d=t[10],f=i+a+d;if(f>0){const p=.5/Math.sqrt(f+1);this._w=.25/p,this._x=(u-l)*p,this._y=(s-c)*p,this._z=(o-r)*p}else if(i>a&&i>d){const p=2*Math.sqrt(1+i-a-d);this._w=(u-l)/p,this._x=.25*p,this._y=(r+o)/p,this._z=(s+c)/p}else if(a>d){const p=2*Math.sqrt(1+a-i-d);this._w=(s-c)/p,this._x=(r+o)/p,this._y=.25*p,this._z=(l+u)/p}else{const p=2*Math.sqrt(1+d-i-a);this._w=(o-r)/p,this._x=(s+c)/p,this._y=(l+u)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let i=e.dot(t)+1;return i<Number.EPSILON?(i=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=i):(this._x=0,this._y=-e.z,this._z=e.y,this._w=i)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=i),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(dn(this.dot(e),-1,1)))}rotateTowards(e,t){const i=this.angleTo(e);if(i===0)return this;const r=Math.min(1,t/i);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const i=e._x,r=e._y,s=e._z,o=e._w,a=t._x,l=t._y,c=t._z,u=t._w;return this._x=i*u+o*a+r*c-s*l,this._y=r*u+o*l+s*a-i*c,this._z=s*u+o*c+i*l-r*a,this._w=o*u-i*a-r*l-s*c,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);const i=this._x,r=this._y,s=this._z,o=this._w;let a=o*e._w+i*e._x+r*e._y+s*e._z;if(a<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,a=-a):this.copy(e),a>=1)return this._w=o,this._x=i,this._y=r,this._z=s,this;const l=1-a*a;if(l<=Number.EPSILON){const p=1-t;return this._w=p*o+t*this._w,this._x=p*i+t*this._x,this._y=p*r+t*this._y,this._z=p*s+t*this._z,this.normalize(),this}const c=Math.sqrt(l),u=Math.atan2(c,a),d=Math.sin((1-t)*u)/c,f=Math.sin(t*u)/c;return this._w=o*d+this._w*f,this._x=i*d+this._x*f,this._y=r*d+this._y*f,this._z=s*d+this._z*f,this._onChangeCallback(),this}slerpQuaternions(e,t,i){return this.copy(e).slerp(t,i)}random(){const e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),i=Math.random(),r=Math.sqrt(1-i),s=Math.sqrt(i);return this.set(r*Math.sin(e),r*Math.cos(e),s*Math.sin(t),s*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class N{constructor(e=0,t=0,i=0){N.prototype.isVector3=!0,this.x=e,this.y=t,this.z=i}set(e,t,i){return i===void 0&&(i=this.z),this.x=e,this.y=t,this.z=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Ng.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Ng.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[3]*i+s[6]*r,this.y=s[1]*t+s[4]*i+s[7]*r,this.z=s[2]*t+s[5]*i+s[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,i=this.y,r=this.z,s=e.elements,o=1/(s[3]*t+s[7]*i+s[11]*r+s[15]);return this.x=(s[0]*t+s[4]*i+s[8]*r+s[12])*o,this.y=(s[1]*t+s[5]*i+s[9]*r+s[13])*o,this.z=(s[2]*t+s[6]*i+s[10]*r+s[14])*o,this}applyQuaternion(e){const t=this.x,i=this.y,r=this.z,s=e.x,o=e.y,a=e.z,l=e.w,c=2*(o*r-a*i),u=2*(a*t-s*r),d=2*(s*i-o*t);return this.x=t+l*c+o*d-a*u,this.y=i+l*u+a*c-s*d,this.z=r+l*d+s*u-o*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[4]*i+s[8]*r,this.y=s[1]*t+s[5]*i+s[9]*r,this.z=s[2]*t+s[6]*i+s[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this}clampLength(e,t){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(e,Math.min(t,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const i=e.x,r=e.y,s=e.z,o=t.x,a=t.y,l=t.z;return this.x=r*l-s*a,this.y=s*o-i*l,this.z=i*a-r*o,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const i=e.dot(this)/t;return this.copy(e).multiplyScalar(i)}projectOnPlane(e){return cd.copy(this).projectOnVector(e),this.sub(cd)}reflect(e){return this.sub(cd.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const i=this.dot(e)/t;return Math.acos(dn(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,i=this.y-e.y,r=this.z-e.z;return t*t+i*i+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,i){const r=Math.sin(t)*e;return this.x=r*Math.sin(i),this.y=Math.cos(t)*e,this.z=r*Math.cos(i),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,i){return this.x=e*Math.sin(t),this.y=i,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=i,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=Math.random()*Math.PI*2,t=Math.random()*2-1,i=Math.sqrt(1-t*t);return this.x=i*Math.cos(e),this.y=t,this.z=i*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const cd=new N,Ng=new Vi;class Ri{constructor(e=new N(1/0,1/0,1/0),t=new N(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t+=3)this.expandByPoint(pi.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,i=e.count;t<i;t++)this.expandByPoint(pi.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const i=pi.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const i=e.geometry;if(i!==void 0){const s=i.getAttribute("position");if(t===!0&&s!==void 0&&e.isInstancedMesh!==!0)for(let o=0,a=s.count;o<a;o++)e.isMesh===!0?e.getVertexPosition(o,pi):pi.fromBufferAttribute(s,o),pi.applyMatrix4(e.matrixWorld),this.expandByPoint(pi);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),kl.copy(e.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),kl.copy(i.boundingBox)),kl.applyMatrix4(e.matrixWorld),this.union(kl)}const r=e.children;for(let s=0,o=r.length;s<o;s++)this.expandByObject(r[s],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,pi),pi.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,i;return e.normal.x>0?(t=e.normal.x*this.min.x,i=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,i=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,i+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,i+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,i+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,i+=e.normal.z*this.min.z),t<=-e.constant&&i>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(da),Ol.subVectors(this.max,da),zs.subVectors(e.a,da),Hs.subVectors(e.b,da),Vs.subVectors(e.c,da),Mr.subVectors(Hs,zs),Er.subVectors(Vs,Hs),is.subVectors(zs,Vs);let t=[0,-Mr.z,Mr.y,0,-Er.z,Er.y,0,-is.z,is.y,Mr.z,0,-Mr.x,Er.z,0,-Er.x,is.z,0,-is.x,-Mr.y,Mr.x,0,-Er.y,Er.x,0,-is.y,is.x,0];return!ud(t,zs,Hs,Vs,Ol)||(t=[1,0,0,0,1,0,0,0,1],!ud(t,zs,Hs,Vs,Ol))?!1:(Fl.crossVectors(Mr,Er),t=[Fl.x,Fl.y,Fl.z],ud(t,zs,Hs,Vs,Ol))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,pi).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(pi).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Ki[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Ki[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Ki[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Ki[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Ki[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Ki[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Ki[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Ki[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Ki),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}}const Ki=[new N,new N,new N,new N,new N,new N,new N,new N],pi=new N,kl=new Ri,zs=new N,Hs=new N,Vs=new N,Mr=new N,Er=new N,is=new N,da=new N,Ol=new N,Fl=new N,rs=new N;function ud(n,e,t,i,r){for(let s=0,o=n.length-3;s<=o;s+=3){rs.fromArray(n,s);const a=r.x*Math.abs(rs.x)+r.y*Math.abs(rs.y)+r.z*Math.abs(rs.z),l=e.dot(rs),c=t.dot(rs),u=i.dot(rs);if(Math.max(-Math.max(l,c,u),Math.min(l,c,u))>a)return!1}return!0}const r1=new Ri,fa=new N,dd=new N;class Ci{constructor(e=new N,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const i=this.center;t!==void 0?i.copy(t):r1.setFromPoints(e).getCenter(i);let r=0;for(let s=0,o=e.length;s<o;s++)r=Math.max(r,i.distanceToSquared(e[s]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const i=this.center.distanceToSquared(e);return t.copy(e),i>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;fa.subVectors(e,this.center);const t=fa.lengthSq();if(t>this.radius*this.radius){const i=Math.sqrt(t),r=(i-this.radius)*.5;this.center.addScaledVector(fa,r/i),this.radius+=r}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(dd.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(fa.copy(e.center).add(dd)),this.expandByPoint(fa.copy(e.center).sub(dd))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}}const qi=new N,fd=new N,Bl=new N,wr=new N,hd=new N,zl=new N,pd=new N;class Xo{constructor(e=new N,t=new N(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,qi)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const i=t.dot(this.direction);return i<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=qi.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(qi.copy(this.origin).addScaledVector(this.direction,t),qi.distanceToSquared(e))}distanceSqToSegment(e,t,i,r){fd.copy(e).add(t).multiplyScalar(.5),Bl.copy(t).sub(e).normalize(),wr.copy(this.origin).sub(fd);const s=e.distanceTo(t)*.5,o=-this.direction.dot(Bl),a=wr.dot(this.direction),l=-wr.dot(Bl),c=wr.lengthSq(),u=Math.abs(1-o*o);let d,f,p,g;if(u>0)if(d=o*l-a,f=o*a-l,g=s*u,d>=0)if(f>=-g)if(f<=g){const v=1/u;d*=v,f*=v,p=d*(d+o*f+2*a)+f*(o*d+f+2*l)+c}else f=s,d=Math.max(0,-(o*f+a)),p=-d*d+f*(f+2*l)+c;else f=-s,d=Math.max(0,-(o*f+a)),p=-d*d+f*(f+2*l)+c;else f<=-g?(d=Math.max(0,-(-o*s+a)),f=d>0?-s:Math.min(Math.max(-s,-l),s),p=-d*d+f*(f+2*l)+c):f<=g?(d=0,f=Math.min(Math.max(-s,-l),s),p=f*(f+2*l)+c):(d=Math.max(0,-(o*s+a)),f=d>0?s:Math.min(Math.max(-s,-l),s),p=-d*d+f*(f+2*l)+c);else f=o>0?-s:s,d=Math.max(0,-(o*f+a)),p=-d*d+f*(f+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,d),r&&r.copy(fd).addScaledVector(Bl,f),p}intersectSphere(e,t){qi.subVectors(e.center,this.origin);const i=qi.dot(this.direction),r=qi.dot(qi)-i*i,s=e.radius*e.radius;if(r>s)return null;const o=Math.sqrt(s-r),a=i-o,l=i+o;return l<0?null:a<0?this.at(l,t):this.at(a,t)}intersectsSphere(e){return this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const i=-(this.origin.dot(e.normal)+e.constant)/t;return i>=0?i:null}intersectPlane(e,t){const i=this.distanceToPlane(e);return i===null?null:this.at(i,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let i,r,s,o,a,l;const c=1/this.direction.x,u=1/this.direction.y,d=1/this.direction.z,f=this.origin;return c>=0?(i=(e.min.x-f.x)*c,r=(e.max.x-f.x)*c):(i=(e.max.x-f.x)*c,r=(e.min.x-f.x)*c),u>=0?(s=(e.min.y-f.y)*u,o=(e.max.y-f.y)*u):(s=(e.max.y-f.y)*u,o=(e.min.y-f.y)*u),i>o||s>r||((s>i||isNaN(i))&&(i=s),(o<r||isNaN(r))&&(r=o),d>=0?(a=(e.min.z-f.z)*d,l=(e.max.z-f.z)*d):(a=(e.max.z-f.z)*d,l=(e.min.z-f.z)*d),i>l||a>r)||((a>i||i!==i)&&(i=a),(l<r||r!==r)&&(r=l),r<0)?null:this.at(i>=0?i:r,t)}intersectsBox(e){return this.intersectBox(e,qi)!==null}intersectTriangle(e,t,i,r,s){hd.subVectors(t,e),zl.subVectors(i,e),pd.crossVectors(hd,zl);let o=this.direction.dot(pd),a;if(o>0){if(r)return null;a=1}else if(o<0)a=-1,o=-o;else return null;wr.subVectors(this.origin,e);const l=a*this.direction.dot(zl.crossVectors(wr,zl));if(l<0)return null;const c=a*this.direction.dot(hd.cross(wr));if(c<0||l+c>o)return null;const u=-a*wr.dot(pd);return u<0?null:this.at(u/o,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class Ze{constructor(e,t,i,r,s,o,a,l,c,u,d,f,p,g,v,m){Ze.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,i,r,s,o,a,l,c,u,d,f,p,g,v,m)}set(e,t,i,r,s,o,a,l,c,u,d,f,p,g,v,m){const h=this.elements;return h[0]=e,h[4]=t,h[8]=i,h[12]=r,h[1]=s,h[5]=o,h[9]=a,h[13]=l,h[2]=c,h[6]=u,h[10]=d,h[14]=f,h[3]=p,h[7]=g,h[11]=v,h[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Ze().fromArray(this.elements)}copy(e){const t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],t[9]=i[9],t[10]=i[10],t[11]=i[11],t[12]=i[12],t[13]=i[13],t[14]=i[14],t[15]=i[15],this}copyPosition(e){const t=this.elements,i=e.elements;return t[12]=i[12],t[13]=i[13],t[14]=i[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,i){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this}makeBasis(e,t,i){return this.set(e.x,t.x,i.x,0,e.y,t.y,i.y,0,e.z,t.z,i.z,0,0,0,0,1),this}extractRotation(e){const t=this.elements,i=e.elements,r=1/Gs.setFromMatrixColumn(e,0).length(),s=1/Gs.setFromMatrixColumn(e,1).length(),o=1/Gs.setFromMatrixColumn(e,2).length();return t[0]=i[0]*r,t[1]=i[1]*r,t[2]=i[2]*r,t[3]=0,t[4]=i[4]*s,t[5]=i[5]*s,t[6]=i[6]*s,t[7]=0,t[8]=i[8]*o,t[9]=i[9]*o,t[10]=i[10]*o,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,i=e.x,r=e.y,s=e.z,o=Math.cos(i),a=Math.sin(i),l=Math.cos(r),c=Math.sin(r),u=Math.cos(s),d=Math.sin(s);if(e.order==="XYZ"){const f=o*u,p=o*d,g=a*u,v=a*d;t[0]=l*u,t[4]=-l*d,t[8]=c,t[1]=p+g*c,t[5]=f-v*c,t[9]=-a*l,t[2]=v-f*c,t[6]=g+p*c,t[10]=o*l}else if(e.order==="YXZ"){const f=l*u,p=l*d,g=c*u,v=c*d;t[0]=f+v*a,t[4]=g*a-p,t[8]=o*c,t[1]=o*d,t[5]=o*u,t[9]=-a,t[2]=p*a-g,t[6]=v+f*a,t[10]=o*l}else if(e.order==="ZXY"){const f=l*u,p=l*d,g=c*u,v=c*d;t[0]=f-v*a,t[4]=-o*d,t[8]=g+p*a,t[1]=p+g*a,t[5]=o*u,t[9]=v-f*a,t[2]=-o*c,t[6]=a,t[10]=o*l}else if(e.order==="ZYX"){const f=o*u,p=o*d,g=a*u,v=a*d;t[0]=l*u,t[4]=g*c-p,t[8]=f*c+v,t[1]=l*d,t[5]=v*c+f,t[9]=p*c-g,t[2]=-c,t[6]=a*l,t[10]=o*l}else if(e.order==="YZX"){const f=o*l,p=o*c,g=a*l,v=a*c;t[0]=l*u,t[4]=v-f*d,t[8]=g*d+p,t[1]=d,t[5]=o*u,t[9]=-a*u,t[2]=-c*u,t[6]=p*d+g,t[10]=f-v*d}else if(e.order==="XZY"){const f=o*l,p=o*c,g=a*l,v=a*c;t[0]=l*u,t[4]=-d,t[8]=c*u,t[1]=f*d+v,t[5]=o*u,t[9]=p*d-g,t[2]=g*d-p,t[6]=a*u,t[10]=v*d+f}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(s1,e,o1)}lookAt(e,t,i){const r=this.elements;return Gn.subVectors(e,t),Gn.lengthSq()===0&&(Gn.z=1),Gn.normalize(),Tr.crossVectors(i,Gn),Tr.lengthSq()===0&&(Math.abs(i.z)===1?Gn.x+=1e-4:Gn.z+=1e-4,Gn.normalize(),Tr.crossVectors(i,Gn)),Tr.normalize(),Hl.crossVectors(Gn,Tr),r[0]=Tr.x,r[4]=Hl.x,r[8]=Gn.x,r[1]=Tr.y,r[5]=Hl.y,r[9]=Gn.y,r[2]=Tr.z,r[6]=Hl.z,r[10]=Gn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const i=e.elements,r=t.elements,s=this.elements,o=i[0],a=i[4],l=i[8],c=i[12],u=i[1],d=i[5],f=i[9],p=i[13],g=i[2],v=i[6],m=i[10],h=i[14],_=i[3],x=i[7],M=i[11],L=i[15],A=r[0],T=r[4],I=r[8],K=r[12],y=r[1],w=r[5],X=r[9],W=r[13],$=r[2],se=r[6],j=r[10],Q=r[14],U=r[3],ie=r[7],re=r[11],fe=r[15];return s[0]=o*A+a*y+l*$+c*U,s[4]=o*T+a*w+l*se+c*ie,s[8]=o*I+a*X+l*j+c*re,s[12]=o*K+a*W+l*Q+c*fe,s[1]=u*A+d*y+f*$+p*U,s[5]=u*T+d*w+f*se+p*ie,s[9]=u*I+d*X+f*j+p*re,s[13]=u*K+d*W+f*Q+p*fe,s[2]=g*A+v*y+m*$+h*U,s[6]=g*T+v*w+m*se+h*ie,s[10]=g*I+v*X+m*j+h*re,s[14]=g*K+v*W+m*Q+h*fe,s[3]=_*A+x*y+M*$+L*U,s[7]=_*T+x*w+M*se+L*ie,s[11]=_*I+x*X+M*j+L*re,s[15]=_*K+x*W+M*Q+L*fe,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],i=e[4],r=e[8],s=e[12],o=e[1],a=e[5],l=e[9],c=e[13],u=e[2],d=e[6],f=e[10],p=e[14],g=e[3],v=e[7],m=e[11],h=e[15];return g*(+s*l*d-r*c*d-s*a*f+i*c*f+r*a*p-i*l*p)+v*(+t*l*p-t*c*f+s*o*f-r*o*p+r*c*u-s*l*u)+m*(+t*c*d-t*a*p-s*o*d+i*o*p+s*a*u-i*c*u)+h*(-r*a*u-t*l*d+t*a*f+r*o*d-i*o*f+i*l*u)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,i){const r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=i),this}invert(){const e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],u=e[8],d=e[9],f=e[10],p=e[11],g=e[12],v=e[13],m=e[14],h=e[15],_=d*m*c-v*f*c+v*l*p-a*m*p-d*l*h+a*f*h,x=g*f*c-u*m*c-g*l*p+o*m*p+u*l*h-o*f*h,M=u*v*c-g*d*c+g*a*p-o*v*p-u*a*h+o*d*h,L=g*d*l-u*v*l-g*a*f+o*v*f+u*a*m-o*d*m,A=t*_+i*x+r*M+s*L;if(A===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const T=1/A;return e[0]=_*T,e[1]=(v*f*s-d*m*s-v*r*p+i*m*p+d*r*h-i*f*h)*T,e[2]=(a*m*s-v*l*s+v*r*c-i*m*c-a*r*h+i*l*h)*T,e[3]=(d*l*s-a*f*s-d*r*c+i*f*c+a*r*p-i*l*p)*T,e[4]=x*T,e[5]=(u*m*s-g*f*s+g*r*p-t*m*p-u*r*h+t*f*h)*T,e[6]=(g*l*s-o*m*s-g*r*c+t*m*c+o*r*h-t*l*h)*T,e[7]=(o*f*s-u*l*s+u*r*c-t*f*c-o*r*p+t*l*p)*T,e[8]=M*T,e[9]=(g*d*s-u*v*s-g*i*p+t*v*p+u*i*h-t*d*h)*T,e[10]=(o*v*s-g*a*s+g*i*c-t*v*c-o*i*h+t*a*h)*T,e[11]=(u*a*s-o*d*s-u*i*c+t*d*c+o*i*p-t*a*p)*T,e[12]=L*T,e[13]=(u*v*r-g*d*r+g*i*f-t*v*f-u*i*m+t*d*m)*T,e[14]=(g*a*r-o*v*r-g*i*l+t*v*l+o*i*m-t*a*m)*T,e[15]=(o*d*r-u*a*r+u*i*l-t*d*l-o*i*f+t*a*f)*T,this}scale(e){const t=this.elements,i=e.x,r=e.y,s=e.z;return t[0]*=i,t[4]*=r,t[8]*=s,t[1]*=i,t[5]*=r,t[9]*=s,t[2]*=i,t[6]*=r,t[10]*=s,t[3]*=i,t[7]*=r,t[11]*=s,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,i,r))}makeTranslation(e,t,i){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,i,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,t,-i,0,0,i,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),i=Math.sin(e);return this.set(t,0,i,0,0,1,0,0,-i,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,0,i,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const i=Math.cos(t),r=Math.sin(t),s=1-i,o=e.x,a=e.y,l=e.z,c=s*o,u=s*a;return this.set(c*o+i,c*a-r*l,c*l+r*a,0,c*a+r*l,u*a+i,u*l-r*o,0,c*l-r*a,u*l+r*o,s*l*l+i,0,0,0,0,1),this}makeScale(e,t,i){return this.set(e,0,0,0,0,t,0,0,0,0,i,0,0,0,0,1),this}makeShear(e,t,i,r,s,o){return this.set(1,i,s,0,e,1,o,0,t,r,1,0,0,0,0,1),this}compose(e,t,i){const r=this.elements,s=t._x,o=t._y,a=t._z,l=t._w,c=s+s,u=o+o,d=a+a,f=s*c,p=s*u,g=s*d,v=o*u,m=o*d,h=a*d,_=l*c,x=l*u,M=l*d,L=i.x,A=i.y,T=i.z;return r[0]=(1-(v+h))*L,r[1]=(p+M)*L,r[2]=(g-x)*L,r[3]=0,r[4]=(p-M)*A,r[5]=(1-(f+h))*A,r[6]=(m+_)*A,r[7]=0,r[8]=(g+x)*T,r[9]=(m-_)*T,r[10]=(1-(f+v))*T,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,i){const r=this.elements;let s=Gs.set(r[0],r[1],r[2]).length();const o=Gs.set(r[4],r[5],r[6]).length(),a=Gs.set(r[8],r[9],r[10]).length();this.determinant()<0&&(s=-s),e.x=r[12],e.y=r[13],e.z=r[14],mi.copy(this);const c=1/s,u=1/o,d=1/a;return mi.elements[0]*=c,mi.elements[1]*=c,mi.elements[2]*=c,mi.elements[4]*=u,mi.elements[5]*=u,mi.elements[6]*=u,mi.elements[8]*=d,mi.elements[9]*=d,mi.elements[10]*=d,t.setFromRotationMatrix(mi),i.x=s,i.y=o,i.z=a,this}makePerspective(e,t,i,r,s,o,a=lr){const l=this.elements,c=2*s/(t-e),u=2*s/(i-r),d=(t+e)/(t-e),f=(i+r)/(i-r);let p,g;if(a===lr)p=-(o+s)/(o-s),g=-2*o*s/(o-s);else if(a===su)p=-o/(o-s),g=-o*s/(o-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return l[0]=c,l[4]=0,l[8]=d,l[12]=0,l[1]=0,l[5]=u,l[9]=f,l[13]=0,l[2]=0,l[6]=0,l[10]=p,l[14]=g,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(e,t,i,r,s,o,a=lr){const l=this.elements,c=1/(t-e),u=1/(i-r),d=1/(o-s),f=(t+e)*c,p=(i+r)*u;let g,v;if(a===lr)g=(o+s)*d,v=-2*d;else if(a===su)g=s*d,v=-1*d;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return l[0]=2*c,l[4]=0,l[8]=0,l[12]=-f,l[1]=0,l[5]=2*u,l[9]=0,l[13]=-p,l[2]=0,l[6]=0,l[10]=v,l[14]=-g,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(e){const t=this.elements,i=e.elements;for(let r=0;r<16;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<16;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){const i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e[t+9]=i[9],e[t+10]=i[10],e[t+11]=i[11],e[t+12]=i[12],e[t+13]=i[13],e[t+14]=i[14],e[t+15]=i[15],e}}const Gs=new N,mi=new Ze,s1=new N(0,0,0),o1=new N(1,1,1),Tr=new N,Hl=new N,Gn=new N,Dg=new Ze,Ig=new Vi;class Gi{constructor(e=0,t=0,i=0,r=Gi.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=i,this._order=r}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,i,r=this._order){return this._x=e,this._y=t,this._z=i,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,i=!0){const r=e.elements,s=r[0],o=r[4],a=r[8],l=r[1],c=r[5],u=r[9],d=r[2],f=r[6],p=r[10];switch(t){case"XYZ":this._y=Math.asin(dn(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-u,p),this._z=Math.atan2(-o,s)):(this._x=Math.atan2(f,c),this._z=0);break;case"YXZ":this._x=Math.asin(-dn(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(a,p),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-d,s),this._z=0);break;case"ZXY":this._x=Math.asin(dn(f,-1,1)),Math.abs(f)<.9999999?(this._y=Math.atan2(-d,p),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-dn(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(f,p),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(dn(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-u,c),this._y=Math.atan2(-d,s)):(this._x=0,this._y=Math.atan2(a,p));break;case"XZY":this._z=Math.asin(-dn(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(f,c),this._y=Math.atan2(a,s)):(this._x=Math.atan2(-u,p),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,i===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,i){return Dg.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Dg,t,i)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Ig.setFromEuler(this),this.setFromQuaternion(Ig,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}Gi.DEFAULT_ORDER="XYZ";class Bp{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let a1=0;const Ug=new N,Ws=new Vi,$i=new Ze,Vl=new N,ha=new N,l1=new N,c1=new Vi,kg=new N(1,0,0),Og=new N(0,1,0),Fg=new N(0,0,1),Bg={type:"added"},u1={type:"removed"},js={type:"childadded",child:null},md={type:"childremoved",child:null};class Bt extends Ds{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:a1++}),this.uuid=Ti(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Bt.DEFAULT_UP.clone();const e=new N,t=new Gi,i=new Vi,r=new N(1,1,1);function s(){i.setFromEuler(t,!1)}function o(){t.setFromQuaternion(i,void 0,!1)}t._onChange(s),i._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new Ze},normalMatrix:{value:new nt}}),this.matrix=new Ze,this.matrixWorld=new Ze,this.matrixAutoUpdate=Bt.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Bt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Bp,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return Ws.setFromAxisAngle(e,t),this.quaternion.multiply(Ws),this}rotateOnWorldAxis(e,t){return Ws.setFromAxisAngle(e,t),this.quaternion.premultiply(Ws),this}rotateX(e){return this.rotateOnAxis(kg,e)}rotateY(e){return this.rotateOnAxis(Og,e)}rotateZ(e){return this.rotateOnAxis(Fg,e)}translateOnAxis(e,t){return Ug.copy(e).applyQuaternion(this.quaternion),this.position.add(Ug.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(kg,e)}translateY(e){return this.translateOnAxis(Og,e)}translateZ(e){return this.translateOnAxis(Fg,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4($i.copy(this.matrixWorld).invert())}lookAt(e,t,i){e.isVector3?Vl.copy(e):Vl.set(e,t,i);const r=this.parent;this.updateWorldMatrix(!0,!1),ha.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?$i.lookAt(ha,Vl,this.up):$i.lookAt(Vl,ha,this.up),this.quaternion.setFromRotationMatrix($i),r&&($i.extractRotation(r.matrixWorld),Ws.setFromRotationMatrix($i),this.quaternion.premultiply(Ws.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Bg),js.child=e,this.dispatchEvent(js),js.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(u1),md.child=e,this.dispatchEvent(md),md.child=null),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),$i.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),$i.multiply(e.parent.matrixWorld)),e.applyMatrix4($i),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Bg),js.child=e,this.dispatchEvent(js),js.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let i=0,r=this.children.length;i<r;i++){const o=this.children[i].getObjectByProperty(e,t);if(o!==void 0)return o}}getObjectsByProperty(e,t,i=[]){this[e]===t&&i.push(this);const r=this.children;for(let s=0,o=r.length;s<o;s++)r[s].getObjectsByProperty(e,t,i);return i}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ha,e,l1),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ha,c1,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);const t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].updateMatrixWorld(e)}updateWorldMatrix(e,t){const i=this.parent;if(e===!0&&i!==null&&i.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),t===!0){const r=this.children;for(let s=0,o=r.length;s<o;s++)r[s].updateWorldMatrix(!1,!0)}}toJSON(e){const t=e===void 0||typeof e=="string",i={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const r={};r.uuid=this.uuid,r.type=this.type,this.name!==""&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.visibility=this._visibility,r.active=this._active,r.bounds=this._bounds.map(a=>({boxInitialized:a.boxInitialized,boxMin:a.box.min.toArray(),boxMax:a.box.max.toArray(),sphereInitialized:a.sphereInitialized,sphereRadius:a.sphere.radius,sphereCenter:a.sphere.center.toArray()})),r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.geometryCount=this._geometryCount,r.matricesTexture=this._matricesTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere={center:r.boundingSphere.center.toArray(),radius:r.boundingSphere.radius}),this.boundingBox!==null&&(r.boundingBox={min:r.boundingBox.min.toArray(),max:r.boundingBox.max.toArray()}));function s(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=s(e.geometries,this.geometry);const a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){const l=a.shapes;if(Array.isArray(l))for(let c=0,u=l.length;c<u;c++){const d=l[c];s(e.shapes,d)}else s(e.shapes,l)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(s(e.materials,this.material[l]));r.material=a}else r.material=s(e.materials,this.material);if(this.children.length>0){r.children=[];for(let a=0;a<this.children.length;a++)r.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let a=0;a<this.animations.length;a++){const l=this.animations[a];r.animations.push(s(e.animations,l))}}if(t){const a=o(e.geometries),l=o(e.materials),c=o(e.textures),u=o(e.images),d=o(e.shapes),f=o(e.skeletons),p=o(e.animations),g=o(e.nodes);a.length>0&&(i.geometries=a),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),u.length>0&&(i.images=u),d.length>0&&(i.shapes=d),f.length>0&&(i.skeletons=f),p.length>0&&(i.animations=p),g.length>0&&(i.nodes=g)}return i.object=r,i;function o(a){const l=[];for(const c in a){const u=a[c];delete u.metadata,l.push(u)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let i=0;i<e.children.length;i++){const r=e.children[i];this.add(r.clone())}return this}}Bt.DEFAULT_UP=new N(0,1,0);Bt.DEFAULT_MATRIX_AUTO_UPDATE=!0;Bt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const gi=new N,Zi=new N,gd=new N,Ji=new N,Xs=new N,Ys=new N,zg=new N,_d=new N,xd=new N,vd=new N,yd=new yt,Sd=new yt,Md=new yt;class Si{constructor(e=new N,t=new N,i=new N){this.a=e,this.b=t,this.c=i}static getNormal(e,t,i,r){r.subVectors(i,t),gi.subVectors(e,t),r.cross(gi);const s=r.lengthSq();return s>0?r.multiplyScalar(1/Math.sqrt(s)):r.set(0,0,0)}static getBarycoord(e,t,i,r,s){gi.subVectors(r,t),Zi.subVectors(i,t),gd.subVectors(e,t);const o=gi.dot(gi),a=gi.dot(Zi),l=gi.dot(gd),c=Zi.dot(Zi),u=Zi.dot(gd),d=o*c-a*a;if(d===0)return s.set(0,0,0),null;const f=1/d,p=(c*l-a*u)*f,g=(o*u-a*l)*f;return s.set(1-p-g,g,p)}static containsPoint(e,t,i,r){return this.getBarycoord(e,t,i,r,Ji)===null?!1:Ji.x>=0&&Ji.y>=0&&Ji.x+Ji.y<=1}static getInterpolation(e,t,i,r,s,o,a,l){return this.getBarycoord(e,t,i,r,Ji)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(s,Ji.x),l.addScaledVector(o,Ji.y),l.addScaledVector(a,Ji.z),l)}static getInterpolatedAttribute(e,t,i,r,s,o){return yd.setScalar(0),Sd.setScalar(0),Md.setScalar(0),yd.fromBufferAttribute(e,t),Sd.fromBufferAttribute(e,i),Md.fromBufferAttribute(e,r),o.setScalar(0),o.addScaledVector(yd,s.x),o.addScaledVector(Sd,s.y),o.addScaledVector(Md,s.z),o}static isFrontFacing(e,t,i,r){return gi.subVectors(i,t),Zi.subVectors(e,t),gi.cross(Zi).dot(r)<0}set(e,t,i){return this.a.copy(e),this.b.copy(t),this.c.copy(i),this}setFromPointsAndIndices(e,t,i,r){return this.a.copy(e[t]),this.b.copy(e[i]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,i,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,i),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return gi.subVectors(this.c,this.b),Zi.subVectors(this.a,this.b),gi.cross(Zi).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return Si.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return Si.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,i,r,s){return Si.getInterpolation(e,this.a,this.b,this.c,t,i,r,s)}containsPoint(e){return Si.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return Si.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const i=this.a,r=this.b,s=this.c;let o,a;Xs.subVectors(r,i),Ys.subVectors(s,i),_d.subVectors(e,i);const l=Xs.dot(_d),c=Ys.dot(_d);if(l<=0&&c<=0)return t.copy(i);xd.subVectors(e,r);const u=Xs.dot(xd),d=Ys.dot(xd);if(u>=0&&d<=u)return t.copy(r);const f=l*d-u*c;if(f<=0&&l>=0&&u<=0)return o=l/(l-u),t.copy(i).addScaledVector(Xs,o);vd.subVectors(e,s);const p=Xs.dot(vd),g=Ys.dot(vd);if(g>=0&&p<=g)return t.copy(s);const v=p*c-l*g;if(v<=0&&c>=0&&g<=0)return a=c/(c-g),t.copy(i).addScaledVector(Ys,a);const m=u*g-p*d;if(m<=0&&d-u>=0&&p-g>=0)return zg.subVectors(s,r),a=(d-u)/(d-u+(p-g)),t.copy(r).addScaledVector(zg,a);const h=1/(m+v+f);return o=v*h,a=f*h,t.copy(i).addScaledVector(Xs,o).addScaledVector(Ys,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}const Uv={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},br={h:0,s:0,l:0},Gl={h:0,s:0,l:0};function Ed(n,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?n+(e-n)*6*t:t<1/2?e:t<2/3?n+(e-n)*6*(2/3-t):n}class Ke{constructor(e,t,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,i)}set(e,t,i){if(t===void 0&&i===void 0){const r=e;r&&r.isColor?this.copy(r):typeof r=="number"?this.setHex(r):typeof r=="string"&&this.setStyle(r)}else this.setRGB(e,t,i);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Jt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,mt.toWorkingColorSpace(this,t),this}setRGB(e,t,i,r=mt.workingColorSpace){return this.r=e,this.g=t,this.b=i,mt.toWorkingColorSpace(this,r),this}setHSL(e,t,i,r=mt.workingColorSpace){if(e=Fp(e,1),t=dn(t,0,1),i=dn(i,0,1),t===0)this.r=this.g=this.b=i;else{const s=i<=.5?i*(1+t):i+t-i*t,o=2*i-s;this.r=Ed(o,s,e+1/3),this.g=Ed(o,s,e),this.b=Ed(o,s,e-1/3)}return mt.toWorkingColorSpace(this,r),this}setStyle(e,t=Jt){function i(s){s!==void 0&&parseFloat(s)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let s;const o=r[1],a=r[2];switch(o){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,t);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,t);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,t);break;default:console.warn("THREE.Color: Unknown color model "+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){const s=r[1],o=s.length;if(o===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,t);if(o===6)return this.setHex(parseInt(s,16),t);console.warn("THREE.Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Jt){const i=Uv[e.toLowerCase()];return i!==void 0?this.setHex(i,t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Eo(e.r),this.g=Eo(e.g),this.b=Eo(e.b),this}copyLinearToSRGB(e){return this.r=ad(e.r),this.g=ad(e.g),this.b=ad(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Jt){return mt.fromWorkingColorSpace(vn.copy(this),e),Math.round(dn(vn.r*255,0,255))*65536+Math.round(dn(vn.g*255,0,255))*256+Math.round(dn(vn.b*255,0,255))}getHexString(e=Jt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=mt.workingColorSpace){mt.fromWorkingColorSpace(vn.copy(this),t);const i=vn.r,r=vn.g,s=vn.b,o=Math.max(i,r,s),a=Math.min(i,r,s);let l,c;const u=(a+o)/2;if(a===o)l=0,c=0;else{const d=o-a;switch(c=u<=.5?d/(o+a):d/(2-o-a),o){case i:l=(r-s)/d+(r<s?6:0);break;case r:l=(s-i)/d+2;break;case s:l=(i-r)/d+4;break}l/=6}return e.h=l,e.s=c,e.l=u,e}getRGB(e,t=mt.workingColorSpace){return mt.fromWorkingColorSpace(vn.copy(this),t),e.r=vn.r,e.g=vn.g,e.b=vn.b,e}getStyle(e=Jt){mt.fromWorkingColorSpace(vn.copy(this),e);const t=vn.r,i=vn.g,r=vn.b;return e!==Jt?`color(${e} ${t.toFixed(3)} ${i.toFixed(3)} ${r.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(i*255)},${Math.round(r*255)})`}offsetHSL(e,t,i){return this.getHSL(br),this.setHSL(br.h+e,br.s+t,br.l+i)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,i){return this.r=e.r+(t.r-e.r)*i,this.g=e.g+(t.g-e.g)*i,this.b=e.b+(t.b-e.b)*i,this}lerpHSL(e,t){this.getHSL(br),e.getHSL(Gl);const i=Ba(br.h,Gl.h,t),r=Ba(br.s,Gl.s,t),s=Ba(br.l,Gl.l,t);return this.setHSL(i,r,s),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,i=this.g,r=this.b,s=e.elements;return this.r=s[0]*t+s[3]*i+s[6]*r,this.g=s[1]*t+s[4]*i+s[7]*r,this.b=s[2]*t+s[5]*i+s[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const vn=new Ke;Ke.NAMES=Uv;let d1=0;class zi extends Ds{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:d1++}),this.uuid=Ti(),this.name="",this.type="Material",this.blending=So,this.side=Hi,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Vf,this.blendDst=Gf,this.blendEquation=gs,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Ke(0,0,0),this.blendAlpha=0,this.depthFunc=No,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=bg,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Fs,this.stencilZFail=Fs,this.stencilZPass=Fs,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const i=e[t];if(i===void 0){console.warn(`THREE.Material: parameter '${t}' has value of undefined.`);continue}const r=this[t];if(r===void 0){console.warn(`THREE.Material: '${t}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(i):r&&r.isVector3&&i&&i.isVector3?r.copy(i):this[t]=i}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const i={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(e).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(e).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(e).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(e).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(e).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==So&&(i.blending=this.blending),this.side!==Hi&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==Vf&&(i.blendSrc=this.blendSrc),this.blendDst!==Gf&&(i.blendDst=this.blendDst),this.blendEquation!==gs&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==No&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==bg&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Fs&&(i.stencilFail=this.stencilFail),this.stencilZFail!==Fs&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==Fs&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function r(s){const o=[];for(const a in s){const l=s[a];delete l.metadata,o.push(l)}return o}if(t){const s=r(e.textures),o=r(e.images);s.length>0&&(i.textures=s),o.length>0&&(i.images=o)}return i}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let i=null;if(t!==null){const r=t.length;i=new Array(r);for(let s=0;s!==r;++s)i[s]=t[s].clone()}return this.clippingPlanes=i,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}onBuild(){console.warn("Material: onBuild() has been removed.")}}class cr extends zi{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Ke(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Gi,this.combine=gv,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const Kt=new N,Wl=new He;class hn{constructor(e,t,i=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=i,this.usage=bh,this.updateRanges=[],this.gpuType=Mi,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,i){e*=this.itemSize,i*=t.itemSize;for(let r=0,s=this.itemSize;r<s;r++)this.array[e+r]=t.array[i+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,i=this.count;t<i;t++)Wl.fromBufferAttribute(this,t),Wl.applyMatrix3(e),this.setXY(t,Wl.x,Wl.y);else if(this.itemSize===3)for(let t=0,i=this.count;t<i;t++)Kt.fromBufferAttribute(this,t),Kt.applyMatrix3(e),this.setXYZ(t,Kt.x,Kt.y,Kt.z);return this}applyMatrix4(e){for(let t=0,i=this.count;t<i;t++)Kt.fromBufferAttribute(this,t),Kt.applyMatrix4(e),this.setXYZ(t,Kt.x,Kt.y,Kt.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)Kt.fromBufferAttribute(this,t),Kt.applyNormalMatrix(e),this.setXYZ(t,Kt.x,Kt.y,Kt.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)Kt.fromBufferAttribute(this,t),Kt.transformDirection(e),this.setXYZ(t,Kt.x,Kt.y,Kt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let i=this.array[e*this.itemSize+t];return this.normalized&&(i=yi(i,this.array)),i}setComponent(e,t,i){return this.normalized&&(i=Mt(i,this.array)),this.array[e*this.itemSize+t]=i,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=yi(t,this.array)),t}setX(e,t){return this.normalized&&(t=Mt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=yi(t,this.array)),t}setY(e,t){return this.normalized&&(t=Mt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=yi(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Mt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=yi(t,this.array)),t}setW(e,t){return this.normalized&&(t=Mt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,i){return e*=this.itemSize,this.normalized&&(t=Mt(t,this.array),i=Mt(i,this.array)),this.array[e+0]=t,this.array[e+1]=i,this}setXYZ(e,t,i,r){return e*=this.itemSize,this.normalized&&(t=Mt(t,this.array),i=Mt(i,this.array),r=Mt(r,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this}setXYZW(e,t,i,r,s){return e*=this.itemSize,this.normalized&&(t=Mt(t,this.array),i=Mt(i,this.array),r=Mt(r,this.array),s=Mt(s,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this.array[e+3]=s,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==bh&&(e.usage=this.usage),e}}class kv extends hn{constructor(e,t,i){super(new Uint16Array(e),t,i)}}class Ov extends hn{constructor(e,t,i){super(new Uint32Array(e),t,i)}}class bi extends hn{constructor(e,t,i){super(new Float32Array(e),t,i)}}let f1=0;const ti=new Ze,wd=new Bt,Ks=new N,Wn=new Ri,pa=new Ri,nn=new N;class di extends Ds{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:f1++}),this.uuid=Ti(),this.name="",this.type="BufferGeometry",this.index=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Nv(e)?Ov:kv)(e,1):this.index=e,this}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,i=0){this.groups.push({start:e,count:t,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const i=this.attributes.normal;if(i!==void 0){const s=new nt().getNormalMatrix(e);i.applyNormalMatrix(s),i.needsUpdate=!0}const r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return ti.makeRotationFromQuaternion(e),this.applyMatrix4(ti),this}rotateX(e){return ti.makeRotationX(e),this.applyMatrix4(ti),this}rotateY(e){return ti.makeRotationY(e),this.applyMatrix4(ti),this}rotateZ(e){return ti.makeRotationZ(e),this.applyMatrix4(ti),this}translate(e,t,i){return ti.makeTranslation(e,t,i),this.applyMatrix4(ti),this}scale(e,t,i){return ti.makeScale(e,t,i),this.applyMatrix4(ti),this}lookAt(e){return wd.lookAt(e),wd.updateMatrix(),this.applyMatrix4(wd.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Ks).negate(),this.translate(Ks.x,Ks.y,Ks.z),this}setFromPoints(e){const t=[];for(let i=0,r=e.length;i<r;i++){const s=e[i];t.push(s.x,s.y,s.z||0)}return this.setAttribute("position",new bi(t,3)),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Ri);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new N(-1/0,-1/0,-1/0),new N(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let i=0,r=t.length;i<r;i++){const s=t[i];Wn.setFromBufferAttribute(s),this.morphTargetsRelative?(nn.addVectors(this.boundingBox.min,Wn.min),this.boundingBox.expandByPoint(nn),nn.addVectors(this.boundingBox.max,Wn.max),this.boundingBox.expandByPoint(nn)):(this.boundingBox.expandByPoint(Wn.min),this.boundingBox.expandByPoint(Wn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Ci);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new N,1/0);return}if(e){const i=this.boundingSphere.center;if(Wn.setFromBufferAttribute(e),t)for(let s=0,o=t.length;s<o;s++){const a=t[s];pa.setFromBufferAttribute(a),this.morphTargetsRelative?(nn.addVectors(Wn.min,pa.min),Wn.expandByPoint(nn),nn.addVectors(Wn.max,pa.max),Wn.expandByPoint(nn)):(Wn.expandByPoint(pa.min),Wn.expandByPoint(pa.max))}Wn.getCenter(i);let r=0;for(let s=0,o=e.count;s<o;s++)nn.fromBufferAttribute(e,s),r=Math.max(r,i.distanceToSquared(nn));if(t)for(let s=0,o=t.length;s<o;s++){const a=t[s],l=this.morphTargetsRelative;for(let c=0,u=a.count;c<u;c++)nn.fromBufferAttribute(a,c),l&&(Ks.fromBufferAttribute(e,c),nn.add(Ks)),r=Math.max(r,i.distanceToSquared(nn))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const i=t.position,r=t.normal,s=t.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new hn(new Float32Array(4*i.count),4));const o=this.getAttribute("tangent"),a=[],l=[];for(let I=0;I<i.count;I++)a[I]=new N,l[I]=new N;const c=new N,u=new N,d=new N,f=new He,p=new He,g=new He,v=new N,m=new N;function h(I,K,y){c.fromBufferAttribute(i,I),u.fromBufferAttribute(i,K),d.fromBufferAttribute(i,y),f.fromBufferAttribute(s,I),p.fromBufferAttribute(s,K),g.fromBufferAttribute(s,y),u.sub(c),d.sub(c),p.sub(f),g.sub(f);const w=1/(p.x*g.y-g.x*p.y);isFinite(w)&&(v.copy(u).multiplyScalar(g.y).addScaledVector(d,-p.y).multiplyScalar(w),m.copy(d).multiplyScalar(p.x).addScaledVector(u,-g.x).multiplyScalar(w),a[I].add(v),a[K].add(v),a[y].add(v),l[I].add(m),l[K].add(m),l[y].add(m))}let _=this.groups;_.length===0&&(_=[{start:0,count:e.count}]);for(let I=0,K=_.length;I<K;++I){const y=_[I],w=y.start,X=y.count;for(let W=w,$=w+X;W<$;W+=3)h(e.getX(W+0),e.getX(W+1),e.getX(W+2))}const x=new N,M=new N,L=new N,A=new N;function T(I){L.fromBufferAttribute(r,I),A.copy(L);const K=a[I];x.copy(K),x.sub(L.multiplyScalar(L.dot(K))).normalize(),M.crossVectors(A,K);const w=M.dot(l[I])<0?-1:1;o.setXYZW(I,x.x,x.y,x.z,w)}for(let I=0,K=_.length;I<K;++I){const y=_[I],w=y.start,X=y.count;for(let W=w,$=w+X;W<$;W+=3)T(e.getX(W+0)),T(e.getX(W+1)),T(e.getX(W+2))}}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let i=this.getAttribute("normal");if(i===void 0)i=new hn(new Float32Array(t.count*3),3),this.setAttribute("normal",i);else for(let f=0,p=i.count;f<p;f++)i.setXYZ(f,0,0,0);const r=new N,s=new N,o=new N,a=new N,l=new N,c=new N,u=new N,d=new N;if(e)for(let f=0,p=e.count;f<p;f+=3){const g=e.getX(f+0),v=e.getX(f+1),m=e.getX(f+2);r.fromBufferAttribute(t,g),s.fromBufferAttribute(t,v),o.fromBufferAttribute(t,m),u.subVectors(o,s),d.subVectors(r,s),u.cross(d),a.fromBufferAttribute(i,g),l.fromBufferAttribute(i,v),c.fromBufferAttribute(i,m),a.add(u),l.add(u),c.add(u),i.setXYZ(g,a.x,a.y,a.z),i.setXYZ(v,l.x,l.y,l.z),i.setXYZ(m,c.x,c.y,c.z)}else for(let f=0,p=t.count;f<p;f+=3)r.fromBufferAttribute(t,f+0),s.fromBufferAttribute(t,f+1),o.fromBufferAttribute(t,f+2),u.subVectors(o,s),d.subVectors(r,s),u.cross(d),i.setXYZ(f+0,u.x,u.y,u.z),i.setXYZ(f+1,u.x,u.y,u.z),i.setXYZ(f+2,u.x,u.y,u.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,i=e.count;t<i;t++)nn.fromBufferAttribute(e,t),nn.normalize(),e.setXYZ(t,nn.x,nn.y,nn.z)}toNonIndexed(){function e(a,l){const c=a.array,u=a.itemSize,d=a.normalized,f=new c.constructor(l.length*u);let p=0,g=0;for(let v=0,m=l.length;v<m;v++){a.isInterleavedBufferAttribute?p=l[v]*a.data.stride+a.offset:p=l[v]*u;for(let h=0;h<u;h++)f[g++]=c[p++]}return new hn(f,u,d)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new di,i=this.index.array,r=this.attributes;for(const a in r){const l=r[a],c=e(l,i);t.setAttribute(a,c)}const s=this.morphAttributes;for(const a in s){const l=[],c=s[a];for(let u=0,d=c.length;u<d;u++){const f=c[u],p=e(f,i);l.push(p)}t.morphAttributes[a]=l}t.morphTargetsRelative=this.morphTargetsRelative;const o=this.groups;for(let a=0,l=o.length;a<l;a++){const c=o[a];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){const e={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const i=this.attributes;for(const l in i){const c=i[l];e.data.attributes[l]=c.toJSON(e.data)}const r={};let s=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],u=[];for(let d=0,f=c.length;d<f;d++){const p=c[d];u.push(p.toJSON(e.data))}u.length>0&&(r[l]=u,s=!0)}s&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);const o=this.groups;o.length>0&&(e.data.groups=JSON.parse(JSON.stringify(o)));const a=this.boundingSphere;return a!==null&&(e.data.boundingSphere={center:a.center.toArray(),radius:a.radius}),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const i=e.index;i!==null&&this.setIndex(i.clone(t));const r=e.attributes;for(const c in r){const u=r[c];this.setAttribute(c,u.clone(t))}const s=e.morphAttributes;for(const c in s){const u=[],d=s[c];for(let f=0,p=d.length;f<p;f++)u.push(d[f].clone(t));this.morphAttributes[c]=u}this.morphTargetsRelative=e.morphTargetsRelative;const o=e.groups;for(let c=0,u=o.length;c<u;c++){const d=o[c];this.addGroup(d.start,d.count,d.materialIndex)}const a=e.boundingBox;a!==null&&(this.boundingBox=a.clone());const l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const Hg=new Ze,ss=new Xo,jl=new Ci,Vg=new N,Xl=new N,Yl=new N,Kl=new N,Td=new N,ql=new N,Gg=new N,$l=new N;class Yn extends Bt{constructor(e=new di,t=new cr){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){const r=t[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=r.length;s<o;s++){const a=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}getVertexPosition(e,t){const i=this.geometry,r=i.attributes.position,s=i.morphAttributes.position,o=i.morphTargetsRelative;t.fromBufferAttribute(r,e);const a=this.morphTargetInfluences;if(s&&a){ql.set(0,0,0);for(let l=0,c=s.length;l<c;l++){const u=a[l],d=s[l];u!==0&&(Td.fromBufferAttribute(d,e),o?ql.addScaledVector(Td,u):ql.addScaledVector(Td.sub(t),u))}t.add(ql)}return t}raycast(e,t){const i=this.geometry,r=this.material,s=this.matrixWorld;r!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),jl.copy(i.boundingSphere),jl.applyMatrix4(s),ss.copy(e.ray).recast(e.near),!(jl.containsPoint(ss.origin)===!1&&(ss.intersectSphere(jl,Vg)===null||ss.origin.distanceToSquared(Vg)>(e.far-e.near)**2))&&(Hg.copy(s).invert(),ss.copy(e.ray).applyMatrix4(Hg),!(i.boundingBox!==null&&ss.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(e,t,ss)))}_computeIntersections(e,t,i){let r;const s=this.geometry,o=this.material,a=s.index,l=s.attributes.position,c=s.attributes.uv,u=s.attributes.uv1,d=s.attributes.normal,f=s.groups,p=s.drawRange;if(a!==null)if(Array.isArray(o))for(let g=0,v=f.length;g<v;g++){const m=f[g],h=o[m.materialIndex],_=Math.max(m.start,p.start),x=Math.min(a.count,Math.min(m.start+m.count,p.start+p.count));for(let M=_,L=x;M<L;M+=3){const A=a.getX(M),T=a.getX(M+1),I=a.getX(M+2);r=Zl(this,h,e,i,c,u,d,A,T,I),r&&(r.faceIndex=Math.floor(M/3),r.face.materialIndex=m.materialIndex,t.push(r))}}else{const g=Math.max(0,p.start),v=Math.min(a.count,p.start+p.count);for(let m=g,h=v;m<h;m+=3){const _=a.getX(m),x=a.getX(m+1),M=a.getX(m+2);r=Zl(this,o,e,i,c,u,d,_,x,M),r&&(r.faceIndex=Math.floor(m/3),t.push(r))}}else if(l!==void 0)if(Array.isArray(o))for(let g=0,v=f.length;g<v;g++){const m=f[g],h=o[m.materialIndex],_=Math.max(m.start,p.start),x=Math.min(l.count,Math.min(m.start+m.count,p.start+p.count));for(let M=_,L=x;M<L;M+=3){const A=M,T=M+1,I=M+2;r=Zl(this,h,e,i,c,u,d,A,T,I),r&&(r.faceIndex=Math.floor(M/3),r.face.materialIndex=m.materialIndex,t.push(r))}}else{const g=Math.max(0,p.start),v=Math.min(l.count,p.start+p.count);for(let m=g,h=v;m<h;m+=3){const _=m,x=m+1,M=m+2;r=Zl(this,o,e,i,c,u,d,_,x,M),r&&(r.faceIndex=Math.floor(m/3),t.push(r))}}}}function h1(n,e,t,i,r,s,o,a){let l;if(e.side===Hn?l=i.intersectTriangle(o,s,r,!0,a):l=i.intersectTriangle(r,s,o,e.side===Hi,a),l===null)return null;$l.copy(a),$l.applyMatrix4(n.matrixWorld);const c=t.ray.origin.distanceTo($l);return c<t.near||c>t.far?null:{distance:c,point:$l.clone(),object:n}}function Zl(n,e,t,i,r,s,o,a,l,c){n.getVertexPosition(a,Xl),n.getVertexPosition(l,Yl),n.getVertexPosition(c,Kl);const u=h1(n,e,t,i,Xl,Yl,Kl,Gg);if(u){const d=new N;Si.getBarycoord(Gg,Xl,Yl,Kl,d),r&&(u.uv=Si.getInterpolatedAttribute(r,a,l,c,d,new He)),s&&(u.uv1=Si.getInterpolatedAttribute(s,a,l,c,d,new He)),o&&(u.normal=Si.getInterpolatedAttribute(o,a,l,c,d,new N),u.normal.dot(i.direction)>0&&u.normal.multiplyScalar(-1));const f={a,b:l,c,normal:new N,materialIndex:0};Si.getNormal(Xl,Yl,Kl,f.normal),u.face=f,u.barycoord=d}return u}class pl extends di{constructor(e=1,t=1,i=1,r=1,s=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:i,widthSegments:r,heightSegments:s,depthSegments:o};const a=this;r=Math.floor(r),s=Math.floor(s),o=Math.floor(o);const l=[],c=[],u=[],d=[];let f=0,p=0;g("z","y","x",-1,-1,i,t,e,o,s,0),g("z","y","x",1,-1,i,t,-e,o,s,1),g("x","z","y",1,1,e,i,t,r,o,2),g("x","z","y",1,-1,e,i,-t,r,o,3),g("x","y","z",1,-1,e,t,i,r,s,4),g("x","y","z",-1,-1,e,t,-i,r,s,5),this.setIndex(l),this.setAttribute("position",new bi(c,3)),this.setAttribute("normal",new bi(u,3)),this.setAttribute("uv",new bi(d,2));function g(v,m,h,_,x,M,L,A,T,I,K){const y=M/T,w=L/I,X=M/2,W=L/2,$=A/2,se=T+1,j=I+1;let Q=0,U=0;const ie=new N;for(let re=0;re<j;re++){const fe=re*w-W;for(let Oe=0;Oe<se;Oe++){const it=Oe*y-X;ie[v]=it*_,ie[m]=fe*x,ie[h]=$,c.push(ie.x,ie.y,ie.z),ie[v]=0,ie[m]=0,ie[h]=A>0?1:-1,u.push(ie.x,ie.y,ie.z),d.push(Oe/T),d.push(1-re/I),Q+=1}}for(let re=0;re<I;re++)for(let fe=0;fe<T;fe++){const Oe=f+fe+se*re,it=f+fe+se*(re+1),Y=f+(fe+1)+se*(re+1),ae=f+(fe+1)+se*re;l.push(Oe,it,ae),l.push(it,Y,ae),U+=6}a.addGroup(p,U,K),p+=U,f+=Q}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new pl(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}function Bo(n){const e={};for(const t in n){e[t]={};for(const i in n[t]){const r=n[t][i];r&&(r.isColor||r.isMatrix3||r.isMatrix4||r.isVector2||r.isVector3||r.isVector4||r.isTexture||r.isQuaternion)?r.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][i]=null):e[t][i]=r.clone():Array.isArray(r)?e[t][i]=r.slice():e[t][i]=r}}return e}function wn(n){const e={};for(let t=0;t<n.length;t++){const i=Bo(n[t]);for(const r in i)e[r]=i[r]}return e}function p1(n){const e=[];for(let t=0;t<n.length;t++)e.push(n[t].clone());return e}function Fv(n){const e=n.getRenderTarget();return e===null?n.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:mt.workingColorSpace}const m1={clone:Bo,merge:wn};var g1=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,_1=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class qr extends zi{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=g1,this.fragmentShader=_1,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Bo(e.uniforms),this.uniformsGroups=p1(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const r in this.uniforms){const o=this.uniforms[r].value;o&&o.isTexture?t.uniforms[r]={type:"t",value:o.toJSON(e).uuid}:o&&o.isColor?t.uniforms[r]={type:"c",value:o.getHex()}:o&&o.isVector2?t.uniforms[r]={type:"v2",value:o.toArray()}:o&&o.isVector3?t.uniforms[r]={type:"v3",value:o.toArray()}:o&&o.isVector4?t.uniforms[r]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?t.uniforms[r]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?t.uniforms[r]={type:"m4",value:o.toArray()}:t.uniforms[r]={value:o}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const i={};for(const r in this.extensions)this.extensions[r]===!0&&(i[r]=!0);return Object.keys(i).length>0&&(t.extensions=i),t}}class Bv extends Bt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Ze,this.projectionMatrix=new Ze,this.projectionMatrixInverse=new Ze,this.coordinateSystem=lr}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const Ar=new N,Wg=new He,jg=new He;class bn extends Bv{constructor(e=50,t=1,i=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=i,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=Fo*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(Fa*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Fo*2*Math.atan(Math.tan(Fa*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,i){Ar.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Ar.x,Ar.y).multiplyScalar(-e/Ar.z),Ar.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(Ar.x,Ar.y).multiplyScalar(-e/Ar.z)}getViewSize(e,t){return this.getViewBounds(e,Wg,jg),t.subVectors(jg,Wg)}setViewOffset(e,t,i,r,s,o){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(Fa*.5*this.fov)/this.zoom,i=2*t,r=this.aspect*i,s=-.5*r;const o=this.view;if(this.view!==null&&this.view.enabled){const l=o.fullWidth,c=o.fullHeight;s+=o.offsetX*r/l,t-=o.offsetY*i/c,r*=o.width/l,i*=o.height/c}const a=this.filmOffset;a!==0&&(s+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+r,t,t-i,e,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}const qs=-90,$s=1;class x1 extends Bt{constructor(e,t,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;const r=new bn(qs,$s,e,t);r.layers=this.layers,this.add(r);const s=new bn(qs,$s,e,t);s.layers=this.layers,this.add(s);const o=new bn(qs,$s,e,t);o.layers=this.layers,this.add(o);const a=new bn(qs,$s,e,t);a.layers=this.layers,this.add(a);const l=new bn(qs,$s,e,t);l.layers=this.layers,this.add(l);const c=new bn(qs,$s,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[i,r,s,o,a,l]=t;for(const c of t)this.remove(c);if(e===lr)i.up.set(0,1,0),i.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===su)i.up.set(0,-1,0),i.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:i,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[s,o,a,l,c,u]=this.children,d=e.getRenderTarget(),f=e.getActiveCubeFace(),p=e.getActiveMipmapLevel(),g=e.xr.enabled;e.xr.enabled=!1;const v=i.texture.generateMipmaps;i.texture.generateMipmaps=!1,e.setRenderTarget(i,0,r),e.render(t,s),e.setRenderTarget(i,1,r),e.render(t,o),e.setRenderTarget(i,2,r),e.render(t,a),e.setRenderTarget(i,3,r),e.render(t,l),e.setRenderTarget(i,4,r),e.render(t,c),i.texture.generateMipmaps=v,e.setRenderTarget(i,5,r),e.render(t,u),e.setRenderTarget(d,f,p),e.xr.enabled=g,i.texture.needsPMREMUpdate=!0}}class zv extends on{constructor(e,t,i,r,s,o,a,l,c,u){e=e!==void 0?e:[],t=t!==void 0?t:Do,super(e,t,i,r,s,o,a,l,c,u),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class v1 extends Ps{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const i={width:e,height:e,depth:1},r=[i,i,i,i,i,i];this.texture=new zv(r,t.mapping,t.wrapS,t.wrapT,t.magFilter,t.minFilter,t.format,t.type,t.anisotropy,t.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=t.generateMipmaps!==void 0?t.generateMipmaps:!1,this.texture.minFilter=t.minFilter!==void 0?t.minFilter:kn}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const i={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new pl(5,5,5),s=new qr({name:"CubemapFromEquirect",uniforms:Bo(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:Hn,blending:Xr});s.uniforms.tEquirect.value=t;const o=new Yn(r,s),a=t.minFilter;return t.minFilter===Oi&&(t.minFilter=kn),new x1(1,10,this).update(e,o),t.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(e,t,i,r){const s=e.getRenderTarget();for(let o=0;o<6;o++)e.setRenderTarget(this,o),e.clear(t,i,r);e.setRenderTarget(s)}}const bd=new N,y1=new N,S1=new nt;class rr{constructor(e=new N(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,i,r){return this.normal.set(e,t,i),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,i){const r=bd.subVectors(i,t).cross(y1.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){const i=e.delta(bd),r=this.normal.dot(i);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const s=-(e.start.dot(this.normal)+this.constant)/r;return s<0||s>1?null:t.copy(e.start).addScaledVector(i,s)}intersectsLine(e){const t=this.distanceToPoint(e.start),i=this.distanceToPoint(e.end);return t<0&&i>0||i<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const i=t||S1.getNormalMatrix(e),r=this.coplanarPoint(bd).applyMatrix4(e),s=this.normal.applyMatrix3(i).normalize();return this.constant=-r.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}const os=new Ci,Jl=new N;class zp{constructor(e=new rr,t=new rr,i=new rr,r=new rr,s=new rr,o=new rr){this.planes=[e,t,i,r,s,o]}set(e,t,i,r,s,o){const a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(i),a[3].copy(r),a[4].copy(s),a[5].copy(o),this}copy(e){const t=this.planes;for(let i=0;i<6;i++)t[i].copy(e.planes[i]);return this}setFromProjectionMatrix(e,t=lr){const i=this.planes,r=e.elements,s=r[0],o=r[1],a=r[2],l=r[3],c=r[4],u=r[5],d=r[6],f=r[7],p=r[8],g=r[9],v=r[10],m=r[11],h=r[12],_=r[13],x=r[14],M=r[15];if(i[0].setComponents(l-s,f-c,m-p,M-h).normalize(),i[1].setComponents(l+s,f+c,m+p,M+h).normalize(),i[2].setComponents(l+o,f+u,m+g,M+_).normalize(),i[3].setComponents(l-o,f-u,m-g,M-_).normalize(),i[4].setComponents(l-a,f-d,m-v,M-x).normalize(),t===lr)i[5].setComponents(l+a,f+d,m+v,M+x).normalize();else if(t===su)i[5].setComponents(a,d,v,x).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),os.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),os.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(os)}intersectsSprite(e){return os.center.set(0,0,0),os.radius=.7071067811865476,os.applyMatrix4(e.matrixWorld),this.intersectsSphere(os)}intersectsSphere(e){const t=this.planes,i=e.center,r=-e.radius;for(let s=0;s<6;s++)if(t[s].distanceToPoint(i)<r)return!1;return!0}intersectsBox(e){const t=this.planes;for(let i=0;i<6;i++){const r=t[i];if(Jl.x=r.normal.x>0?e.max.x:e.min.x,Jl.y=r.normal.y>0?e.max.y:e.min.y,Jl.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(Jl)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let i=0;i<6;i++)if(t[i].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function Hv(){let n=null,e=!1,t=null,i=null;function r(s,o){t(s,o),i=n.requestAnimationFrame(r)}return{start:function(){e!==!0&&t!==null&&(i=n.requestAnimationFrame(r),e=!0)},stop:function(){n.cancelAnimationFrame(i),e=!1},setAnimationLoop:function(s){t=s},setContext:function(s){n=s}}}function M1(n){const e=new WeakMap;function t(a,l){const c=a.array,u=a.usage,d=c.byteLength,f=n.createBuffer();n.bindBuffer(l,f),n.bufferData(l,c,u),a.onUploadCallback();let p;if(c instanceof Float32Array)p=n.FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?p=n.HALF_FLOAT:p=n.UNSIGNED_SHORT;else if(c instanceof Int16Array)p=n.SHORT;else if(c instanceof Uint32Array)p=n.UNSIGNED_INT;else if(c instanceof Int32Array)p=n.INT;else if(c instanceof Int8Array)p=n.BYTE;else if(c instanceof Uint8Array)p=n.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)p=n.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:f,type:p,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:d}}function i(a,l,c){const u=l.array,d=l.updateRanges;if(n.bindBuffer(c,a),d.length===0)n.bufferSubData(c,0,u);else{d.sort((p,g)=>p.start-g.start);let f=0;for(let p=1;p<d.length;p++){const g=d[f],v=d[p];v.start<=g.start+g.count+1?g.count=Math.max(g.count,v.start+v.count-g.start):(++f,d[f]=v)}d.length=f+1;for(let p=0,g=d.length;p<g;p++){const v=d[p];n.bufferSubData(c,v.start*u.BYTES_PER_ELEMENT,u,v.start,v.count)}l.clearUpdateRanges()}l.onUploadCallback()}function r(a){return a.isInterleavedBufferAttribute&&(a=a.data),e.get(a)}function s(a){a.isInterleavedBufferAttribute&&(a=a.data);const l=e.get(a);l&&(n.deleteBuffer(l.buffer),e.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){const u=e.get(a);(!u||u.version<a.version)&&e.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}const c=e.get(a);if(c===void 0)e.set(a,t(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,a,l),c.version=a.version}}return{get:r,remove:s,update:o}}class Ru extends di{constructor(e=1,t=1,i=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:i,heightSegments:r};const s=e/2,o=t/2,a=Math.floor(i),l=Math.floor(r),c=a+1,u=l+1,d=e/a,f=t/l,p=[],g=[],v=[],m=[];for(let h=0;h<u;h++){const _=h*f-o;for(let x=0;x<c;x++){const M=x*d-s;g.push(M,-_,0),v.push(0,0,1),m.push(x/a),m.push(1-h/l)}}for(let h=0;h<l;h++)for(let _=0;_<a;_++){const x=_+c*h,M=_+c*(h+1),L=_+1+c*(h+1),A=_+1+c*h;p.push(x,M,A),p.push(M,L,A)}this.setIndex(p),this.setAttribute("position",new bi(g,3)),this.setAttribute("normal",new bi(v,3)),this.setAttribute("uv",new bi(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Ru(e.width,e.height,e.widthSegments,e.heightSegments)}}var E1=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,w1=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,T1=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,b1=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,A1=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,R1=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,C1=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,P1=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,L1=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,N1=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,D1=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,I1=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,U1=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,k1=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,O1=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,F1=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,B1=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,z1=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,H1=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,V1=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,G1=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,W1=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,j1=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,X1=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Y1=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,K1=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,q1=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,$1=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Z1=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,J1=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Q1="gl_FragColor = linearToOutputTexel( gl_FragColor );",ew=`
const mat3 LINEAR_SRGB_TO_LINEAR_DISPLAY_P3 = mat3(
	vec3( 0.8224621, 0.177538, 0.0 ),
	vec3( 0.0331941, 0.9668058, 0.0 ),
	vec3( 0.0170827, 0.0723974, 0.9105199 )
);
const mat3 LINEAR_DISPLAY_P3_TO_LINEAR_SRGB = mat3(
	vec3( 1.2249401, - 0.2249404, 0.0 ),
	vec3( - 0.0420569, 1.0420571, 0.0 ),
	vec3( - 0.0196376, - 0.0786361, 1.0982735 )
);
vec4 LinearSRGBToLinearDisplayP3( in vec4 value ) {
	return vec4( value.rgb * LINEAR_SRGB_TO_LINEAR_DISPLAY_P3, value.a );
}
vec4 LinearDisplayP3ToLinearSRGB( in vec4 value ) {
	return vec4( value.rgb * LINEAR_DISPLAY_P3_TO_LINEAR_SRGB, value.a );
}
vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,tw=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,nw=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,iw=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,rw=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,sw=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,ow=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,aw=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,lw=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,cw=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,uw=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,dw=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,fw=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,hw=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,pw=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,mw=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,gw=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,_w=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,xw=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,vw=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,yw=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Sw=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Mw=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Ew=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,ww=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Tw=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,bw=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Aw=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Rw=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Cw=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
	
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Pw=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Lw=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Nw=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Dw=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Iw=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Uw=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,kw=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Ow=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Fw=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Bw=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,zw=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Hw=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Vw=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Gw=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Ww=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,jw=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Xw=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Yw=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Kw=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,qw=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,$w=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Zw=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,Jw=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Qw=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,eT=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,tT=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,nT=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,iT=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,rT=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,sT=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,oT=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,aT=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,lT=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,cT=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,uT=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,dT=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,fT=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,hT=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,pT=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,mT=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,gT=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,_T=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
		
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
		
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		
		#else
		
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,xT=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,vT=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,yT=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,ST=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const MT=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,ET=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,wT=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,TT=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,bT=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,AT=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,RT=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,CT=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,PT=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,LT=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,NT=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,DT=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,IT=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,UT=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,kT=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,OT=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,FT=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,BT=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,zT=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,HT=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,VT=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,GT=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,WT=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,jT=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,XT=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,YT=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,KT=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,qT=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,$T=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,ZT=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,JT=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,QT=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,eb=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,tb=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,tt={alphahash_fragment:E1,alphahash_pars_fragment:w1,alphamap_fragment:T1,alphamap_pars_fragment:b1,alphatest_fragment:A1,alphatest_pars_fragment:R1,aomap_fragment:C1,aomap_pars_fragment:P1,batching_pars_vertex:L1,batching_vertex:N1,begin_vertex:D1,beginnormal_vertex:I1,bsdfs:U1,iridescence_fragment:k1,bumpmap_pars_fragment:O1,clipping_planes_fragment:F1,clipping_planes_pars_fragment:B1,clipping_planes_pars_vertex:z1,clipping_planes_vertex:H1,color_fragment:V1,color_pars_fragment:G1,color_pars_vertex:W1,color_vertex:j1,common:X1,cube_uv_reflection_fragment:Y1,defaultnormal_vertex:K1,displacementmap_pars_vertex:q1,displacementmap_vertex:$1,emissivemap_fragment:Z1,emissivemap_pars_fragment:J1,colorspace_fragment:Q1,colorspace_pars_fragment:ew,envmap_fragment:tw,envmap_common_pars_fragment:nw,envmap_pars_fragment:iw,envmap_pars_vertex:rw,envmap_physical_pars_fragment:mw,envmap_vertex:sw,fog_vertex:ow,fog_pars_vertex:aw,fog_fragment:lw,fog_pars_fragment:cw,gradientmap_pars_fragment:uw,lightmap_pars_fragment:dw,lights_lambert_fragment:fw,lights_lambert_pars_fragment:hw,lights_pars_begin:pw,lights_toon_fragment:gw,lights_toon_pars_fragment:_w,lights_phong_fragment:xw,lights_phong_pars_fragment:vw,lights_physical_fragment:yw,lights_physical_pars_fragment:Sw,lights_fragment_begin:Mw,lights_fragment_maps:Ew,lights_fragment_end:ww,logdepthbuf_fragment:Tw,logdepthbuf_pars_fragment:bw,logdepthbuf_pars_vertex:Aw,logdepthbuf_vertex:Rw,map_fragment:Cw,map_pars_fragment:Pw,map_particle_fragment:Lw,map_particle_pars_fragment:Nw,metalnessmap_fragment:Dw,metalnessmap_pars_fragment:Iw,morphinstance_vertex:Uw,morphcolor_vertex:kw,morphnormal_vertex:Ow,morphtarget_pars_vertex:Fw,morphtarget_vertex:Bw,normal_fragment_begin:zw,normal_fragment_maps:Hw,normal_pars_fragment:Vw,normal_pars_vertex:Gw,normal_vertex:Ww,normalmap_pars_fragment:jw,clearcoat_normal_fragment_begin:Xw,clearcoat_normal_fragment_maps:Yw,clearcoat_pars_fragment:Kw,iridescence_pars_fragment:qw,opaque_fragment:$w,packing:Zw,premultiplied_alpha_fragment:Jw,project_vertex:Qw,dithering_fragment:eT,dithering_pars_fragment:tT,roughnessmap_fragment:nT,roughnessmap_pars_fragment:iT,shadowmap_pars_fragment:rT,shadowmap_pars_vertex:sT,shadowmap_vertex:oT,shadowmask_pars_fragment:aT,skinbase_vertex:lT,skinning_pars_vertex:cT,skinning_vertex:uT,skinnormal_vertex:dT,specularmap_fragment:fT,specularmap_pars_fragment:hT,tonemapping_fragment:pT,tonemapping_pars_fragment:mT,transmission_fragment:gT,transmission_pars_fragment:_T,uv_pars_fragment:xT,uv_pars_vertex:vT,uv_vertex:yT,worldpos_vertex:ST,background_vert:MT,background_frag:ET,backgroundCube_vert:wT,backgroundCube_frag:TT,cube_vert:bT,cube_frag:AT,depth_vert:RT,depth_frag:CT,distanceRGBA_vert:PT,distanceRGBA_frag:LT,equirect_vert:NT,equirect_frag:DT,linedashed_vert:IT,linedashed_frag:UT,meshbasic_vert:kT,meshbasic_frag:OT,meshlambert_vert:FT,meshlambert_frag:BT,meshmatcap_vert:zT,meshmatcap_frag:HT,meshnormal_vert:VT,meshnormal_frag:GT,meshphong_vert:WT,meshphong_frag:jT,meshphysical_vert:XT,meshphysical_frag:YT,meshtoon_vert:KT,meshtoon_frag:qT,points_vert:$T,points_frag:ZT,shadow_vert:JT,shadow_frag:QT,sprite_vert:eb,sprite_frag:tb},_e={common:{diffuse:{value:new Ke(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new nt},alphaMap:{value:null},alphaMapTransform:{value:new nt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new nt}},envmap:{envMap:{value:null},envMapRotation:{value:new nt},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new nt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new nt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new nt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new nt},normalScale:{value:new He(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new nt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new nt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new nt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new nt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ke(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Ke(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new nt},alphaTest:{value:0},uvTransform:{value:new nt}},sprite:{diffuse:{value:new Ke(16777215)},opacity:{value:1},center:{value:new He(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new nt},alphaMap:{value:null},alphaMapTransform:{value:new nt},alphaTest:{value:0}}},Ii={basic:{uniforms:wn([_e.common,_e.specularmap,_e.envmap,_e.aomap,_e.lightmap,_e.fog]),vertexShader:tt.meshbasic_vert,fragmentShader:tt.meshbasic_frag},lambert:{uniforms:wn([_e.common,_e.specularmap,_e.envmap,_e.aomap,_e.lightmap,_e.emissivemap,_e.bumpmap,_e.normalmap,_e.displacementmap,_e.fog,_e.lights,{emissive:{value:new Ke(0)}}]),vertexShader:tt.meshlambert_vert,fragmentShader:tt.meshlambert_frag},phong:{uniforms:wn([_e.common,_e.specularmap,_e.envmap,_e.aomap,_e.lightmap,_e.emissivemap,_e.bumpmap,_e.normalmap,_e.displacementmap,_e.fog,_e.lights,{emissive:{value:new Ke(0)},specular:{value:new Ke(1118481)},shininess:{value:30}}]),vertexShader:tt.meshphong_vert,fragmentShader:tt.meshphong_frag},standard:{uniforms:wn([_e.common,_e.envmap,_e.aomap,_e.lightmap,_e.emissivemap,_e.bumpmap,_e.normalmap,_e.displacementmap,_e.roughnessmap,_e.metalnessmap,_e.fog,_e.lights,{emissive:{value:new Ke(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:tt.meshphysical_vert,fragmentShader:tt.meshphysical_frag},toon:{uniforms:wn([_e.common,_e.aomap,_e.lightmap,_e.emissivemap,_e.bumpmap,_e.normalmap,_e.displacementmap,_e.gradientmap,_e.fog,_e.lights,{emissive:{value:new Ke(0)}}]),vertexShader:tt.meshtoon_vert,fragmentShader:tt.meshtoon_frag},matcap:{uniforms:wn([_e.common,_e.bumpmap,_e.normalmap,_e.displacementmap,_e.fog,{matcap:{value:null}}]),vertexShader:tt.meshmatcap_vert,fragmentShader:tt.meshmatcap_frag},points:{uniforms:wn([_e.points,_e.fog]),vertexShader:tt.points_vert,fragmentShader:tt.points_frag},dashed:{uniforms:wn([_e.common,_e.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:tt.linedashed_vert,fragmentShader:tt.linedashed_frag},depth:{uniforms:wn([_e.common,_e.displacementmap]),vertexShader:tt.depth_vert,fragmentShader:tt.depth_frag},normal:{uniforms:wn([_e.common,_e.bumpmap,_e.normalmap,_e.displacementmap,{opacity:{value:1}}]),vertexShader:tt.meshnormal_vert,fragmentShader:tt.meshnormal_frag},sprite:{uniforms:wn([_e.sprite,_e.fog]),vertexShader:tt.sprite_vert,fragmentShader:tt.sprite_frag},background:{uniforms:{uvTransform:{value:new nt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:tt.background_vert,fragmentShader:tt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new nt}},vertexShader:tt.backgroundCube_vert,fragmentShader:tt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:tt.cube_vert,fragmentShader:tt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:tt.equirect_vert,fragmentShader:tt.equirect_frag},distanceRGBA:{uniforms:wn([_e.common,_e.displacementmap,{referencePosition:{value:new N},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:tt.distanceRGBA_vert,fragmentShader:tt.distanceRGBA_frag},shadow:{uniforms:wn([_e.lights,_e.fog,{color:{value:new Ke(0)},opacity:{value:1}}]),vertexShader:tt.shadow_vert,fragmentShader:tt.shadow_frag}};Ii.physical={uniforms:wn([Ii.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new nt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new nt},clearcoatNormalScale:{value:new He(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new nt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new nt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new nt},sheen:{value:0},sheenColor:{value:new Ke(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new nt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new nt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new nt},transmissionSamplerSize:{value:new He},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new nt},attenuationDistance:{value:0},attenuationColor:{value:new Ke(0)},specularColor:{value:new Ke(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new nt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new nt},anisotropyVector:{value:new He},anisotropyMap:{value:null},anisotropyMapTransform:{value:new nt}}]),vertexShader:tt.meshphysical_vert,fragmentShader:tt.meshphysical_frag};const Ql={r:0,b:0,g:0},as=new Gi,nb=new Ze;function ib(n,e,t,i,r,s,o){const a=new Ke(0);let l=s===!0?0:1,c,u,d=null,f=0,p=null;function g(_){let x=_.isScene===!0?_.background:null;return x&&x.isTexture&&(x=(_.backgroundBlurriness>0?t:e).get(x)),x}function v(_){let x=!1;const M=g(_);M===null?h(a,l):M&&M.isColor&&(h(M,1),x=!0);const L=n.xr.getEnvironmentBlendMode();L==="additive"?i.buffers.color.setClear(0,0,0,1,o):L==="alpha-blend"&&i.buffers.color.setClear(0,0,0,0,o),(n.autoClear||x)&&(i.buffers.depth.setTest(!0),i.buffers.depth.setMask(!0),i.buffers.color.setMask(!0),n.clear(n.autoClearColor,n.autoClearDepth,n.autoClearStencil))}function m(_,x){const M=g(x);M&&(M.isCubeTexture||M.mapping===bu)?(u===void 0&&(u=new Yn(new pl(1,1,1),new qr({name:"BackgroundCubeMaterial",uniforms:Bo(Ii.backgroundCube.uniforms),vertexShader:Ii.backgroundCube.vertexShader,fragmentShader:Ii.backgroundCube.fragmentShader,side:Hn,depthTest:!1,depthWrite:!1,fog:!1})),u.geometry.deleteAttribute("normal"),u.geometry.deleteAttribute("uv"),u.onBeforeRender=function(L,A,T){this.matrixWorld.copyPosition(T.matrixWorld)},Object.defineProperty(u.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),r.update(u)),as.copy(x.backgroundRotation),as.x*=-1,as.y*=-1,as.z*=-1,M.isCubeTexture&&M.isRenderTargetTexture===!1&&(as.y*=-1,as.z*=-1),u.material.uniforms.envMap.value=M,u.material.uniforms.flipEnvMap.value=M.isCubeTexture&&M.isRenderTargetTexture===!1?-1:1,u.material.uniforms.backgroundBlurriness.value=x.backgroundBlurriness,u.material.uniforms.backgroundIntensity.value=x.backgroundIntensity,u.material.uniforms.backgroundRotation.value.setFromMatrix4(nb.makeRotationFromEuler(as)),u.material.toneMapped=mt.getTransfer(M.colorSpace)!==Nt,(d!==M||f!==M.version||p!==n.toneMapping)&&(u.material.needsUpdate=!0,d=M,f=M.version,p=n.toneMapping),u.layers.enableAll(),_.unshift(u,u.geometry,u.material,0,0,null)):M&&M.isTexture&&(c===void 0&&(c=new Yn(new Ru(2,2),new qr({name:"BackgroundMaterial",uniforms:Bo(Ii.background.uniforms),vertexShader:Ii.background.vertexShader,fragmentShader:Ii.background.fragmentShader,side:Hi,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),r.update(c)),c.material.uniforms.t2D.value=M,c.material.uniforms.backgroundIntensity.value=x.backgroundIntensity,c.material.toneMapped=mt.getTransfer(M.colorSpace)!==Nt,M.matrixAutoUpdate===!0&&M.updateMatrix(),c.material.uniforms.uvTransform.value.copy(M.matrix),(d!==M||f!==M.version||p!==n.toneMapping)&&(c.material.needsUpdate=!0,d=M,f=M.version,p=n.toneMapping),c.layers.enableAll(),_.unshift(c,c.geometry,c.material,0,0,null))}function h(_,x){_.getRGB(Ql,Fv(n)),i.buffers.color.setClear(Ql.r,Ql.g,Ql.b,x,o)}return{getClearColor:function(){return a},setClearColor:function(_,x=1){a.set(_),l=x,h(a,l)},getClearAlpha:function(){return l},setClearAlpha:function(_){l=_,h(a,l)},render:v,addToRenderList:m}}function rb(n,e){const t=n.getParameter(n.MAX_VERTEX_ATTRIBS),i={},r=f(null);let s=r,o=!1;function a(y,w,X,W,$){let se=!1;const j=d(W,X,w);s!==j&&(s=j,c(s.object)),se=p(y,W,X,$),se&&g(y,W,X,$),$!==null&&e.update($,n.ELEMENT_ARRAY_BUFFER),(se||o)&&(o=!1,M(y,w,X,W),$!==null&&n.bindBuffer(n.ELEMENT_ARRAY_BUFFER,e.get($).buffer))}function l(){return n.createVertexArray()}function c(y){return n.bindVertexArray(y)}function u(y){return n.deleteVertexArray(y)}function d(y,w,X){const W=X.wireframe===!0;let $=i[y.id];$===void 0&&($={},i[y.id]=$);let se=$[w.id];se===void 0&&(se={},$[w.id]=se);let j=se[W];return j===void 0&&(j=f(l()),se[W]=j),j}function f(y){const w=[],X=[],W=[];for(let $=0;$<t;$++)w[$]=0,X[$]=0,W[$]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:w,enabledAttributes:X,attributeDivisors:W,object:y,attributes:{},index:null}}function p(y,w,X,W){const $=s.attributes,se=w.attributes;let j=0;const Q=X.getAttributes();for(const U in Q)if(Q[U].location>=0){const re=$[U];let fe=se[U];if(fe===void 0&&(U==="instanceMatrix"&&y.instanceMatrix&&(fe=y.instanceMatrix),U==="instanceColor"&&y.instanceColor&&(fe=y.instanceColor)),re===void 0||re.attribute!==fe||fe&&re.data!==fe.data)return!0;j++}return s.attributesNum!==j||s.index!==W}function g(y,w,X,W){const $={},se=w.attributes;let j=0;const Q=X.getAttributes();for(const U in Q)if(Q[U].location>=0){let re=se[U];re===void 0&&(U==="instanceMatrix"&&y.instanceMatrix&&(re=y.instanceMatrix),U==="instanceColor"&&y.instanceColor&&(re=y.instanceColor));const fe={};fe.attribute=re,re&&re.data&&(fe.data=re.data),$[U]=fe,j++}s.attributes=$,s.attributesNum=j,s.index=W}function v(){const y=s.newAttributes;for(let w=0,X=y.length;w<X;w++)y[w]=0}function m(y){h(y,0)}function h(y,w){const X=s.newAttributes,W=s.enabledAttributes,$=s.attributeDivisors;X[y]=1,W[y]===0&&(n.enableVertexAttribArray(y),W[y]=1),$[y]!==w&&(n.vertexAttribDivisor(y,w),$[y]=w)}function _(){const y=s.newAttributes,w=s.enabledAttributes;for(let X=0,W=w.length;X<W;X++)w[X]!==y[X]&&(n.disableVertexAttribArray(X),w[X]=0)}function x(y,w,X,W,$,se,j){j===!0?n.vertexAttribIPointer(y,w,X,$,se):n.vertexAttribPointer(y,w,X,W,$,se)}function M(y,w,X,W){v();const $=W.attributes,se=X.getAttributes(),j=w.defaultAttributeValues;for(const Q in se){const U=se[Q];if(U.location>=0){let ie=$[Q];if(ie===void 0&&(Q==="instanceMatrix"&&y.instanceMatrix&&(ie=y.instanceMatrix),Q==="instanceColor"&&y.instanceColor&&(ie=y.instanceColor)),ie!==void 0){const re=ie.normalized,fe=ie.itemSize,Oe=e.get(ie);if(Oe===void 0)continue;const it=Oe.buffer,Y=Oe.type,ae=Oe.bytesPerElement,Me=Y===n.INT||Y===n.UNSIGNED_INT||ie.gpuType===Pp;if(ie.isInterleavedBufferAttribute){const ve=ie.data,qe=ve.stride,Fe=ie.offset;if(ve.isInstancedInterleavedBuffer){for(let lt=0;lt<U.locationSize;lt++)h(U.location+lt,ve.meshPerAttribute);y.isInstancedMesh!==!0&&W._maxInstanceCount===void 0&&(W._maxInstanceCount=ve.meshPerAttribute*ve.count)}else for(let lt=0;lt<U.locationSize;lt++)m(U.location+lt);n.bindBuffer(n.ARRAY_BUFFER,it);for(let lt=0;lt<U.locationSize;lt++)x(U.location+lt,fe/U.locationSize,Y,re,qe*ae,(Fe+fe/U.locationSize*lt)*ae,Me)}else{if(ie.isInstancedBufferAttribute){for(let ve=0;ve<U.locationSize;ve++)h(U.location+ve,ie.meshPerAttribute);y.isInstancedMesh!==!0&&W._maxInstanceCount===void 0&&(W._maxInstanceCount=ie.meshPerAttribute*ie.count)}else for(let ve=0;ve<U.locationSize;ve++)m(U.location+ve);n.bindBuffer(n.ARRAY_BUFFER,it);for(let ve=0;ve<U.locationSize;ve++)x(U.location+ve,fe/U.locationSize,Y,re,fe*ae,fe/U.locationSize*ve*ae,Me)}}else if(j!==void 0){const re=j[Q];if(re!==void 0)switch(re.length){case 2:n.vertexAttrib2fv(U.location,re);break;case 3:n.vertexAttrib3fv(U.location,re);break;case 4:n.vertexAttrib4fv(U.location,re);break;default:n.vertexAttrib1fv(U.location,re)}}}}_()}function L(){I();for(const y in i){const w=i[y];for(const X in w){const W=w[X];for(const $ in W)u(W[$].object),delete W[$];delete w[X]}delete i[y]}}function A(y){if(i[y.id]===void 0)return;const w=i[y.id];for(const X in w){const W=w[X];for(const $ in W)u(W[$].object),delete W[$];delete w[X]}delete i[y.id]}function T(y){for(const w in i){const X=i[w];if(X[y.id]===void 0)continue;const W=X[y.id];for(const $ in W)u(W[$].object),delete W[$];delete X[y.id]}}function I(){K(),o=!0,s!==r&&(s=r,c(s.object))}function K(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:a,reset:I,resetDefaultState:K,dispose:L,releaseStatesOfGeometry:A,releaseStatesOfProgram:T,initAttributes:v,enableAttribute:m,disableUnusedAttributes:_}}function sb(n,e,t){let i;function r(c){i=c}function s(c,u){n.drawArrays(i,c,u),t.update(u,i,1)}function o(c,u,d){d!==0&&(n.drawArraysInstanced(i,c,u,d),t.update(u,i,d))}function a(c,u,d){if(d===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,c,0,u,0,d);let p=0;for(let g=0;g<d;g++)p+=u[g];t.update(p,i,1)}function l(c,u,d,f){if(d===0)return;const p=e.get("WEBGL_multi_draw");if(p===null)for(let g=0;g<c.length;g++)o(c[g],u[g],f[g]);else{p.multiDrawArraysInstancedWEBGL(i,c,0,u,0,f,0,d);let g=0;for(let v=0;v<d;v++)g+=u[v];for(let v=0;v<f.length;v++)t.update(g,i,f[v])}}this.setMode=r,this.render=s,this.renderInstances=o,this.renderMultiDraw=a,this.renderMultiDrawInstances=l}function ob(n,e,t,i){let r;function s(){if(r!==void 0)return r;if(e.has("EXT_texture_filter_anisotropic")===!0){const T=e.get("EXT_texture_filter_anisotropic");r=n.getParameter(T.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function o(T){return!(T!==ai&&i.convert(T)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(T){const I=T===hl&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(T!==gr&&i.convert(T)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_TYPE)&&T!==Mi&&!I)}function l(T){if(T==="highp"){if(n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.HIGH_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.HIGH_FLOAT).precision>0)return"highp";T="mediump"}return T==="mediump"&&n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.MEDIUM_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp";const u=l(c);u!==c&&(console.warn("THREE.WebGLRenderer:",c,"not supported, using",u,"instead."),c=u);const d=t.logarithmicDepthBuffer===!0,f=t.reverseDepthBuffer===!0&&e.has("EXT_clip_control");if(f===!0){const T=e.get("EXT_clip_control");T.clipControlEXT(T.LOWER_LEFT_EXT,T.ZERO_TO_ONE_EXT)}const p=n.getParameter(n.MAX_TEXTURE_IMAGE_UNITS),g=n.getParameter(n.MAX_VERTEX_TEXTURE_IMAGE_UNITS),v=n.getParameter(n.MAX_TEXTURE_SIZE),m=n.getParameter(n.MAX_CUBE_MAP_TEXTURE_SIZE),h=n.getParameter(n.MAX_VERTEX_ATTRIBS),_=n.getParameter(n.MAX_VERTEX_UNIFORM_VECTORS),x=n.getParameter(n.MAX_VARYING_VECTORS),M=n.getParameter(n.MAX_FRAGMENT_UNIFORM_VECTORS),L=g>0,A=n.getParameter(n.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:d,reverseDepthBuffer:f,maxTextures:p,maxVertexTextures:g,maxTextureSize:v,maxCubemapSize:m,maxAttributes:h,maxVertexUniforms:_,maxVaryings:x,maxFragmentUniforms:M,vertexTextures:L,maxSamples:A}}function ab(n){const e=this;let t=null,i=0,r=!1,s=!1;const o=new rr,a=new nt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(d,f){const p=d.length!==0||f||i!==0||r;return r=f,i=d.length,p},this.beginShadows=function(){s=!0,u(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(d,f){t=u(d,f,0)},this.setState=function(d,f,p){const g=d.clippingPlanes,v=d.clipIntersection,m=d.clipShadows,h=n.get(d);if(!r||g===null||g.length===0||s&&!m)s?u(null):c();else{const _=s?0:i,x=_*4;let M=h.clippingState||null;l.value=M,M=u(g,f,x,p);for(let L=0;L!==x;++L)M[L]=t[L];h.clippingState=M,this.numIntersection=v?this.numPlanes:0,this.numPlanes+=_}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=i>0),e.numPlanes=i,e.numIntersection=0}function u(d,f,p,g){const v=d!==null?d.length:0;let m=null;if(v!==0){if(m=l.value,g!==!0||m===null){const h=p+v*4,_=f.matrixWorldInverse;a.getNormalMatrix(_),(m===null||m.length<h)&&(m=new Float32Array(h));for(let x=0,M=p;x!==v;++x,M+=4)o.copy(d[x]).applyMatrix4(_,a),o.normal.toArray(m,M),m[M+3]=o.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=v,e.numIntersection=0,m}}function lb(n){let e=new WeakMap;function t(o,a){return a===Zf?o.mapping=Do:a===Jf&&(o.mapping=Io),o}function i(o){if(o&&o.isTexture){const a=o.mapping;if(a===Zf||a===Jf)if(e.has(o)){const l=e.get(o).texture;return t(l,o.mapping)}else{const l=o.image;if(l&&l.height>0){const c=new v1(l.height);return c.fromEquirectangularTexture(n,o),e.set(o,c),o.addEventListener("dispose",r),t(c.texture,o.mapping)}else return null}}return o}function r(o){const a=o.target;a.removeEventListener("dispose",r);const l=e.get(a);l!==void 0&&(e.delete(a),l.dispose())}function s(){e=new WeakMap}return{get:i,dispose:s}}class Hp extends Bv{constructor(e=-1,t=1,i=1,r=-1,s=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=i,this.bottom=r,this.near=s,this.far=o,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,i,r,s,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,r=(this.top+this.bottom)/2;let s=i-e,o=i+e,a=r+t,l=r-t;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=c*this.view.offsetX,o=s+c*this.view.width,a-=u*this.view.offsetY,l=a-u*this.view.height}this.projectionMatrix.makeOrthographic(s,o,a,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}const ho=4,Xg=[.125,.215,.35,.446,.526,.582],_s=20,Ad=new Hp,Yg=new Ke;let Rd=null,Cd=0,Pd=0,Ld=!1;const ms=(1+Math.sqrt(5))/2,Zs=1/ms,Kg=[new N(-ms,Zs,0),new N(ms,Zs,0),new N(-Zs,0,ms),new N(Zs,0,ms),new N(0,ms,-Zs),new N(0,ms,Zs),new N(-1,1,-1),new N(1,1,-1),new N(-1,1,1),new N(1,1,1)];class qg{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,i=.1,r=100){Rd=this._renderer.getRenderTarget(),Cd=this._renderer.getActiveCubeFace(),Pd=this._renderer.getActiveMipmapLevel(),Ld=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);const s=this._allocateTargets();return s.depthBuffer=!0,this._sceneToCubeUV(e,i,r,s),t>0&&this._blur(s,0,0,t),this._applyPMREM(s),this._cleanup(s),s}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Jg(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Zg(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodPlanes.length;e++)this._lodPlanes[e].dispose()}_cleanup(e){this._renderer.setRenderTarget(Rd,Cd,Pd),this._renderer.xr.enabled=Ld,e.scissorTest=!1,ec(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===Do||e.mapping===Io?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Rd=this._renderer.getRenderTarget(),Cd=this._renderer.getActiveCubeFace(),Pd=this._renderer.getActiveMipmapLevel(),Ld=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const i=t||this._allocateTargets();return this._textureToCubeUV(e,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,i={magFilter:kn,minFilter:kn,generateMipmaps:!1,type:hl,format:ai,colorSpace:an,depthBuffer:!1},r=$g(e,t,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=$g(e,t,i);const{_lodMax:s}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=cb(s)),this._blurMaterial=ub(s,e,t)}return r}_compileMaterial(e){const t=new Yn(this._lodPlanes[0],e);this._renderer.compile(t,Ad)}_sceneToCubeUV(e,t,i,r){const a=new bn(90,1,t,i),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],u=this._renderer,d=u.autoClear,f=u.toneMapping;u.getClearColor(Yg),u.toneMapping=dr,u.autoClear=!1;const p=new cr({name:"PMREM.Background",side:Hn,depthWrite:!1,depthTest:!1}),g=new Yn(new pl,p);let v=!1;const m=e.background;m?m.isColor&&(p.color.copy(m),e.background=null,v=!0):(p.color.copy(Yg),v=!0);for(let h=0;h<6;h++){const _=h%3;_===0?(a.up.set(0,l[h],0),a.lookAt(c[h],0,0)):_===1?(a.up.set(0,0,l[h]),a.lookAt(0,c[h],0)):(a.up.set(0,l[h],0),a.lookAt(0,0,c[h]));const x=this._cubeSize;ec(r,_*x,h>2?x:0,x,x),u.setRenderTarget(r),v&&u.render(g,a),u.render(e,a)}g.geometry.dispose(),g.material.dispose(),u.toneMapping=f,u.autoClear=d,e.background=m}_textureToCubeUV(e,t){const i=this._renderer,r=e.mapping===Do||e.mapping===Io;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=Jg()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Zg());const s=r?this._cubemapMaterial:this._equirectMaterial,o=new Yn(this._lodPlanes[0],s),a=s.uniforms;a.envMap.value=e;const l=this._cubeSize;ec(t,0,0,3*l,2*l),i.setRenderTarget(t),i.render(o,Ad)}_applyPMREM(e){const t=this._renderer,i=t.autoClear;t.autoClear=!1;const r=this._lodPlanes.length;for(let s=1;s<r;s++){const o=Math.sqrt(this._sigmas[s]*this._sigmas[s]-this._sigmas[s-1]*this._sigmas[s-1]),a=Kg[(r-s-1)%Kg.length];this._blur(e,s-1,s,o,a)}t.autoClear=i}_blur(e,t,i,r,s){const o=this._pingPongRenderTarget;this._halfBlur(e,o,t,i,r,"latitudinal",s),this._halfBlur(o,e,i,i,r,"longitudinal",s)}_halfBlur(e,t,i,r,s,o,a){const l=this._renderer,c=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const u=3,d=new Yn(this._lodPlanes[r],c),f=c.uniforms,p=this._sizeLods[i]-1,g=isFinite(s)?Math.PI/(2*p):2*Math.PI/(2*_s-1),v=s/g,m=isFinite(s)?1+Math.floor(u*v):_s;m>_s&&console.warn(`sigmaRadians, ${s}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${_s}`);const h=[];let _=0;for(let T=0;T<_s;++T){const I=T/v,K=Math.exp(-I*I/2);h.push(K),T===0?_+=K:T<m&&(_+=2*K)}for(let T=0;T<h.length;T++)h[T]=h[T]/_;f.envMap.value=e.texture,f.samples.value=m,f.weights.value=h,f.latitudinal.value=o==="latitudinal",a&&(f.poleAxis.value=a);const{_lodMax:x}=this;f.dTheta.value=g,f.mipInt.value=x-i;const M=this._sizeLods[r],L=3*M*(r>x-ho?r-x+ho:0),A=4*(this._cubeSize-M);ec(t,L,A,3*M,2*M),l.setRenderTarget(t),l.render(d,Ad)}}function cb(n){const e=[],t=[],i=[];let r=n;const s=n-ho+1+Xg.length;for(let o=0;o<s;o++){const a=Math.pow(2,r);t.push(a);let l=1/a;o>n-ho?l=Xg[o-n+ho-1]:o===0&&(l=0),i.push(l);const c=1/(a-2),u=-c,d=1+c,f=[u,u,d,u,d,d,u,u,d,d,u,d],p=6,g=6,v=3,m=2,h=1,_=new Float32Array(v*g*p),x=new Float32Array(m*g*p),M=new Float32Array(h*g*p);for(let A=0;A<p;A++){const T=A%3*2/3-1,I=A>2?0:-1,K=[T,I,0,T+2/3,I,0,T+2/3,I+1,0,T,I,0,T+2/3,I+1,0,T,I+1,0];_.set(K,v*g*A),x.set(f,m*g*A);const y=[A,A,A,A,A,A];M.set(y,h*g*A)}const L=new di;L.setAttribute("position",new hn(_,v)),L.setAttribute("uv",new hn(x,m)),L.setAttribute("faceIndex",new hn(M,h)),e.push(L),r>ho&&r--}return{lodPlanes:e,sizeLods:t,sigmas:i}}function $g(n,e,t){const i=new Ps(n,e,t);return i.texture.mapping=bu,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function ec(n,e,t,i,r){n.viewport.set(e,t,i,r),n.scissor.set(e,t,i,r)}function ub(n,e,t){const i=new Float32Array(_s),r=new N(0,1,0);return new qr({name:"SphericalGaussianBlur",defines:{n:_s,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:r}},vertexShader:Vp(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Xr,depthTest:!1,depthWrite:!1})}function Zg(){return new qr({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Vp(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Xr,depthTest:!1,depthWrite:!1})}function Jg(){return new qr({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Vp(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Xr,depthTest:!1,depthWrite:!1})}function Vp(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function db(n){let e=new WeakMap,t=null;function i(a){if(a&&a.isTexture){const l=a.mapping,c=l===Zf||l===Jf,u=l===Do||l===Io;if(c||u){let d=e.get(a);const f=d!==void 0?d.texture.pmremVersion:0;if(a.isRenderTargetTexture&&a.pmremVersion!==f)return t===null&&(t=new qg(n)),d=c?t.fromEquirectangular(a,d):t.fromCubemap(a,d),d.texture.pmremVersion=a.pmremVersion,e.set(a,d),d.texture;if(d!==void 0)return d.texture;{const p=a.image;return c&&p&&p.height>0||u&&p&&r(p)?(t===null&&(t=new qg(n)),d=c?t.fromEquirectangular(a):t.fromCubemap(a),d.texture.pmremVersion=a.pmremVersion,e.set(a,d),a.addEventListener("dispose",s),d.texture):null}}}return a}function r(a){let l=0;const c=6;for(let u=0;u<c;u++)a[u]!==void 0&&l++;return l===c}function s(a){const l=a.target;l.removeEventListener("dispose",s);const c=e.get(l);c!==void 0&&(e.delete(l),c.dispose())}function o(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}return{get:i,dispose:o}}function fb(n){const e={};function t(i){if(e[i]!==void 0)return e[i];let r;switch(i){case"WEBGL_depth_texture":r=n.getExtension("WEBGL_depth_texture")||n.getExtension("MOZ_WEBGL_depth_texture")||n.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":r=n.getExtension("EXT_texture_filter_anisotropic")||n.getExtension("MOZ_EXT_texture_filter_anisotropic")||n.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":r=n.getExtension("WEBGL_compressed_texture_s3tc")||n.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":r=n.getExtension("WEBGL_compressed_texture_pvrtc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:r=n.getExtension(i)}return e[i]=r,r}return{has:function(i){return t(i)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(i){const r=t(i);return r===null&&Cc("THREE.WebGLRenderer: "+i+" extension not supported."),r}}}function hb(n,e,t,i){const r={},s=new WeakMap;function o(d){const f=d.target;f.index!==null&&e.remove(f.index);for(const g in f.attributes)e.remove(f.attributes[g]);for(const g in f.morphAttributes){const v=f.morphAttributes[g];for(let m=0,h=v.length;m<h;m++)e.remove(v[m])}f.removeEventListener("dispose",o),delete r[f.id];const p=s.get(f);p&&(e.remove(p),s.delete(f)),i.releaseStatesOfGeometry(f),f.isInstancedBufferGeometry===!0&&delete f._maxInstanceCount,t.memory.geometries--}function a(d,f){return r[f.id]===!0||(f.addEventListener("dispose",o),r[f.id]=!0,t.memory.geometries++),f}function l(d){const f=d.attributes;for(const g in f)e.update(f[g],n.ARRAY_BUFFER);const p=d.morphAttributes;for(const g in p){const v=p[g];for(let m=0,h=v.length;m<h;m++)e.update(v[m],n.ARRAY_BUFFER)}}function c(d){const f=[],p=d.index,g=d.attributes.position;let v=0;if(p!==null){const _=p.array;v=p.version;for(let x=0,M=_.length;x<M;x+=3){const L=_[x+0],A=_[x+1],T=_[x+2];f.push(L,A,A,T,T,L)}}else if(g!==void 0){const _=g.array;v=g.version;for(let x=0,M=_.length/3-1;x<M;x+=3){const L=x+0,A=x+1,T=x+2;f.push(L,A,A,T,T,L)}}else return;const m=new(Nv(f)?Ov:kv)(f,1);m.version=v;const h=s.get(d);h&&e.remove(h),s.set(d,m)}function u(d){const f=s.get(d);if(f){const p=d.index;p!==null&&f.version<p.version&&c(d)}else c(d);return s.get(d)}return{get:a,update:l,getWireframeAttribute:u}}function pb(n,e,t){let i;function r(f){i=f}let s,o;function a(f){s=f.type,o=f.bytesPerElement}function l(f,p){n.drawElements(i,p,s,f*o),t.update(p,i,1)}function c(f,p,g){g!==0&&(n.drawElementsInstanced(i,p,s,f*o,g),t.update(p,i,g))}function u(f,p,g){if(g===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,p,0,s,f,0,g);let m=0;for(let h=0;h<g;h++)m+=p[h];t.update(m,i,1)}function d(f,p,g,v){if(g===0)return;const m=e.get("WEBGL_multi_draw");if(m===null)for(let h=0;h<f.length;h++)c(f[h]/o,p[h],v[h]);else{m.multiDrawElementsInstancedWEBGL(i,p,0,s,f,0,v,0,g);let h=0;for(let _=0;_<g;_++)h+=p[_];for(let _=0;_<v.length;_++)t.update(h,i,v[_])}}this.setMode=r,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=u,this.renderMultiDrawInstances=d}function mb(n){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(s,o,a){switch(t.calls++,o){case n.TRIANGLES:t.triangles+=a*(s/3);break;case n.LINES:t.lines+=a*(s/2);break;case n.LINE_STRIP:t.lines+=a*(s-1);break;case n.LINE_LOOP:t.lines+=a*s;break;case n.POINTS:t.points+=a*s;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",o);break}}function r(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:r,update:i}}function gb(n,e,t){const i=new WeakMap,r=new yt;function s(o,a,l){const c=o.morphTargetInfluences,u=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,d=u!==void 0?u.length:0;let f=i.get(a);if(f===void 0||f.count!==d){let y=function(){I.dispose(),i.delete(a),a.removeEventListener("dispose",y)};var p=y;f!==void 0&&f.texture.dispose();const g=a.morphAttributes.position!==void 0,v=a.morphAttributes.normal!==void 0,m=a.morphAttributes.color!==void 0,h=a.morphAttributes.position||[],_=a.morphAttributes.normal||[],x=a.morphAttributes.color||[];let M=0;g===!0&&(M=1),v===!0&&(M=2),m===!0&&(M=3);let L=a.attributes.position.count*M,A=1;L>e.maxTextureSize&&(A=Math.ceil(L/e.maxTextureSize),L=e.maxTextureSize);const T=new Float32Array(L*A*4*d),I=new Iv(T,L,A,d);I.type=Mi,I.needsUpdate=!0;const K=M*4;for(let w=0;w<d;w++){const X=h[w],W=_[w],$=x[w],se=L*A*4*w;for(let j=0;j<X.count;j++){const Q=j*K;g===!0&&(r.fromBufferAttribute(X,j),T[se+Q+0]=r.x,T[se+Q+1]=r.y,T[se+Q+2]=r.z,T[se+Q+3]=0),v===!0&&(r.fromBufferAttribute(W,j),T[se+Q+4]=r.x,T[se+Q+5]=r.y,T[se+Q+6]=r.z,T[se+Q+7]=0),m===!0&&(r.fromBufferAttribute($,j),T[se+Q+8]=r.x,T[se+Q+9]=r.y,T[se+Q+10]=r.z,T[se+Q+11]=$.itemSize===4?r.w:1)}}f={count:d,texture:I,size:new He(L,A)},i.set(a,f),a.addEventListener("dispose",y)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(n,"morphTexture",o.morphTexture,t);else{let g=0;for(let m=0;m<c.length;m++)g+=c[m];const v=a.morphTargetsRelative?1:1-g;l.getUniforms().setValue(n,"morphTargetBaseInfluence",v),l.getUniforms().setValue(n,"morphTargetInfluences",c)}l.getUniforms().setValue(n,"morphTargetsTexture",f.texture,t),l.getUniforms().setValue(n,"morphTargetsTextureSize",f.size)}return{update:s}}function _b(n,e,t,i){let r=new WeakMap;function s(l){const c=i.render.frame,u=l.geometry,d=e.get(l,u);if(r.get(d)!==c&&(e.update(d),r.set(d,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",a)===!1&&l.addEventListener("dispose",a),r.get(l)!==c&&(t.update(l.instanceMatrix,n.ARRAY_BUFFER),l.instanceColor!==null&&t.update(l.instanceColor,n.ARRAY_BUFFER),r.set(l,c))),l.isSkinnedMesh){const f=l.skeleton;r.get(f)!==c&&(f.update(),r.set(f,c))}return d}function o(){r=new WeakMap}function a(l){const c=l.target;c.removeEventListener("dispose",a),t.remove(c.instanceMatrix),c.instanceColor!==null&&t.remove(c.instanceColor)}return{update:s,dispose:o}}class Vv extends on{constructor(e,t,i,r,s,o,a,l,c,u=Mo){if(u!==Mo&&u!==Oo)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");i===void 0&&u===Mo&&(i=Cs),i===void 0&&u===Oo&&(i=ko),super(null,r,s,o,a,l,u,i,c),this.isDepthTexture=!0,this.image={width:e,height:t},this.magFilter=a!==void 0?a:An,this.minFilter=l!==void 0?l:An,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}}const Gv=new on,Qg=new Vv(1,1),Wv=new Iv,jv=new i1,Xv=new zv,e0=[],t0=[],n0=new Float32Array(16),i0=new Float32Array(9),r0=new Float32Array(4);function Yo(n,e,t){const i=n[0];if(i<=0||i>0)return n;const r=e*t;let s=e0[r];if(s===void 0&&(s=new Float32Array(r),e0[r]=s),e!==0){i.toArray(s,0);for(let o=1,a=0;o!==e;++o)a+=t,n[o].toArray(s,a)}return s}function en(n,e){if(n.length!==e.length)return!1;for(let t=0,i=n.length;t<i;t++)if(n[t]!==e[t])return!1;return!0}function tn(n,e){for(let t=0,i=e.length;t<i;t++)n[t]=e[t]}function Cu(n,e){let t=t0[e];t===void 0&&(t=new Int32Array(e),t0[e]=t);for(let i=0;i!==e;++i)t[i]=n.allocateTextureUnit();return t}function xb(n,e){const t=this.cache;t[0]!==e&&(n.uniform1f(this.addr,e),t[0]=e)}function vb(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(en(t,e))return;n.uniform2fv(this.addr,e),tn(t,e)}}function yb(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(n.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(en(t,e))return;n.uniform3fv(this.addr,e),tn(t,e)}}function Sb(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(en(t,e))return;n.uniform4fv(this.addr,e),tn(t,e)}}function Mb(n,e){const t=this.cache,i=e.elements;if(i===void 0){if(en(t,e))return;n.uniformMatrix2fv(this.addr,!1,e),tn(t,e)}else{if(en(t,i))return;r0.set(i),n.uniformMatrix2fv(this.addr,!1,r0),tn(t,i)}}function Eb(n,e){const t=this.cache,i=e.elements;if(i===void 0){if(en(t,e))return;n.uniformMatrix3fv(this.addr,!1,e),tn(t,e)}else{if(en(t,i))return;i0.set(i),n.uniformMatrix3fv(this.addr,!1,i0),tn(t,i)}}function wb(n,e){const t=this.cache,i=e.elements;if(i===void 0){if(en(t,e))return;n.uniformMatrix4fv(this.addr,!1,e),tn(t,e)}else{if(en(t,i))return;n0.set(i),n.uniformMatrix4fv(this.addr,!1,n0),tn(t,i)}}function Tb(n,e){const t=this.cache;t[0]!==e&&(n.uniform1i(this.addr,e),t[0]=e)}function bb(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(en(t,e))return;n.uniform2iv(this.addr,e),tn(t,e)}}function Ab(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(en(t,e))return;n.uniform3iv(this.addr,e),tn(t,e)}}function Rb(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(en(t,e))return;n.uniform4iv(this.addr,e),tn(t,e)}}function Cb(n,e){const t=this.cache;t[0]!==e&&(n.uniform1ui(this.addr,e),t[0]=e)}function Pb(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(en(t,e))return;n.uniform2uiv(this.addr,e),tn(t,e)}}function Lb(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(en(t,e))return;n.uniform3uiv(this.addr,e),tn(t,e)}}function Nb(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(en(t,e))return;n.uniform4uiv(this.addr,e),tn(t,e)}}function Db(n,e,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r);let s;this.type===n.SAMPLER_2D_SHADOW?(Qg.compareFunction=Pv,s=Qg):s=Gv,t.setTexture2D(e||s,r)}function Ib(n,e,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture3D(e||jv,r)}function Ub(n,e,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTextureCube(e||Xv,r)}function kb(n,e,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture2DArray(e||Wv,r)}function Ob(n){switch(n){case 5126:return xb;case 35664:return vb;case 35665:return yb;case 35666:return Sb;case 35674:return Mb;case 35675:return Eb;case 35676:return wb;case 5124:case 35670:return Tb;case 35667:case 35671:return bb;case 35668:case 35672:return Ab;case 35669:case 35673:return Rb;case 5125:return Cb;case 36294:return Pb;case 36295:return Lb;case 36296:return Nb;case 35678:case 36198:case 36298:case 36306:case 35682:return Db;case 35679:case 36299:case 36307:return Ib;case 35680:case 36300:case 36308:case 36293:return Ub;case 36289:case 36303:case 36311:case 36292:return kb}}function Fb(n,e){n.uniform1fv(this.addr,e)}function Bb(n,e){const t=Yo(e,this.size,2);n.uniform2fv(this.addr,t)}function zb(n,e){const t=Yo(e,this.size,3);n.uniform3fv(this.addr,t)}function Hb(n,e){const t=Yo(e,this.size,4);n.uniform4fv(this.addr,t)}function Vb(n,e){const t=Yo(e,this.size,4);n.uniformMatrix2fv(this.addr,!1,t)}function Gb(n,e){const t=Yo(e,this.size,9);n.uniformMatrix3fv(this.addr,!1,t)}function Wb(n,e){const t=Yo(e,this.size,16);n.uniformMatrix4fv(this.addr,!1,t)}function jb(n,e){n.uniform1iv(this.addr,e)}function Xb(n,e){n.uniform2iv(this.addr,e)}function Yb(n,e){n.uniform3iv(this.addr,e)}function Kb(n,e){n.uniform4iv(this.addr,e)}function qb(n,e){n.uniform1uiv(this.addr,e)}function $b(n,e){n.uniform2uiv(this.addr,e)}function Zb(n,e){n.uniform3uiv(this.addr,e)}function Jb(n,e){n.uniform4uiv(this.addr,e)}function Qb(n,e,t){const i=this.cache,r=e.length,s=Cu(t,r);en(i,s)||(n.uniform1iv(this.addr,s),tn(i,s));for(let o=0;o!==r;++o)t.setTexture2D(e[o]||Gv,s[o])}function eA(n,e,t){const i=this.cache,r=e.length,s=Cu(t,r);en(i,s)||(n.uniform1iv(this.addr,s),tn(i,s));for(let o=0;o!==r;++o)t.setTexture3D(e[o]||jv,s[o])}function tA(n,e,t){const i=this.cache,r=e.length,s=Cu(t,r);en(i,s)||(n.uniform1iv(this.addr,s),tn(i,s));for(let o=0;o!==r;++o)t.setTextureCube(e[o]||Xv,s[o])}function nA(n,e,t){const i=this.cache,r=e.length,s=Cu(t,r);en(i,s)||(n.uniform1iv(this.addr,s),tn(i,s));for(let o=0;o!==r;++o)t.setTexture2DArray(e[o]||Wv,s[o])}function iA(n){switch(n){case 5126:return Fb;case 35664:return Bb;case 35665:return zb;case 35666:return Hb;case 35674:return Vb;case 35675:return Gb;case 35676:return Wb;case 5124:case 35670:return jb;case 35667:case 35671:return Xb;case 35668:case 35672:return Yb;case 35669:case 35673:return Kb;case 5125:return qb;case 36294:return $b;case 36295:return Zb;case 36296:return Jb;case 35678:case 36198:case 36298:case 36306:case 35682:return Qb;case 35679:case 36299:case 36307:return eA;case 35680:case 36300:case 36308:case 36293:return tA;case 36289:case 36303:case 36311:case 36292:return nA}}class rA{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.setValue=Ob(t.type)}}class sA{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=iA(t.type)}}class oA{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,i){const r=this.seq;for(let s=0,o=r.length;s!==o;++s){const a=r[s];a.setValue(e,t[a.id],i)}}}const Nd=/(\w+)(\])?(\[|\.)?/g;function s0(n,e){n.seq.push(e),n.map[e.id]=e}function aA(n,e,t){const i=n.name,r=i.length;for(Nd.lastIndex=0;;){const s=Nd.exec(i),o=Nd.lastIndex;let a=s[1];const l=s[2]==="]",c=s[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===r){s0(t,c===void 0?new rA(a,n,e):new sA(a,n,e));break}else{let d=t.map[a];d===void 0&&(d=new oA(a),s0(t,d)),t=d}}}class Pc{constructor(e,t){this.seq=[],this.map={};const i=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<i;++r){const s=e.getActiveUniform(t,r),o=e.getUniformLocation(t,s.name);aA(s,o,this)}}setValue(e,t,i,r){const s=this.map[t];s!==void 0&&s.setValue(e,i,r)}setOptional(e,t,i){const r=t[i];r!==void 0&&this.setValue(e,i,r)}static upload(e,t,i,r){for(let s=0,o=t.length;s!==o;++s){const a=t[s],l=i[a.id];l.needsUpdate!==!1&&a.setValue(e,l.value,r)}}static seqWithValue(e,t){const i=[];for(let r=0,s=e.length;r!==s;++r){const o=e[r];o.id in t&&i.push(o)}return i}}function o0(n,e,t){const i=n.createShader(e);return n.shaderSource(i,t),n.compileShader(i),i}const lA=37297;let cA=0;function uA(n,e){const t=n.split(`
`),i=[],r=Math.max(e-6,0),s=Math.min(e+6,t.length);for(let o=r;o<s;o++){const a=o+1;i.push(`${a===e?">":" "} ${a}: ${t[o]}`)}return i.join(`
`)}function dA(n){const e=mt.getPrimaries(mt.workingColorSpace),t=mt.getPrimaries(n);let i;switch(e===t?i="":e===ru&&t===iu?i="LinearDisplayP3ToLinearSRGB":e===iu&&t===ru&&(i="LinearSRGBToLinearDisplayP3"),n){case an:case Au:return[i,"LinearTransferOETF"];case Jt:case Op:return[i,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space:",n),[i,"LinearTransferOETF"]}}function a0(n,e,t){const i=n.getShaderParameter(e,n.COMPILE_STATUS),r=n.getShaderInfoLog(e).trim();if(i&&r==="")return"";const s=/ERROR: 0:(\d+)/.exec(r);if(s){const o=parseInt(s[1]);return t.toUpperCase()+`

`+r+`

`+uA(n.getShaderSource(e),o)}else return r}function fA(n,e){const t=dA(e);return`vec4 ${n}( vec4 value ) { return ${t[0]}( ${t[1]}( value ) ); }`}function hA(n,e){let t;switch(e){case fE:t="Linear";break;case hE:t="Reinhard";break;case pE:t="Cineon";break;case mE:t="ACESFilmic";break;case _E:t="AgX";break;case xE:t="Neutral";break;case gE:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+n+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const tc=new N;function pA(){mt.getLuminanceCoefficients(tc);const n=tc.x.toFixed(4),e=tc.y.toFixed(4),t=tc.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${n}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function mA(n){return[n.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",n.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Ra).join(`
`)}function gA(n){const e=[];for(const t in n){const i=n[t];i!==!1&&e.push("#define "+t+" "+i)}return e.join(`
`)}function _A(n,e){const t={},i=n.getProgramParameter(e,n.ACTIVE_ATTRIBUTES);for(let r=0;r<i;r++){const s=n.getActiveAttrib(e,r),o=s.name;let a=1;s.type===n.FLOAT_MAT2&&(a=2),s.type===n.FLOAT_MAT3&&(a=3),s.type===n.FLOAT_MAT4&&(a=4),t[o]={type:s.type,location:n.getAttribLocation(e,o),locationSize:a}}return t}function Ra(n){return n!==""}function l0(n,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return n.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function c0(n,e){return n.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const xA=/^[ \t]*#include +<([\w\d./]+)>/gm;function Ah(n){return n.replace(xA,yA)}const vA=new Map;function yA(n,e){let t=tt[e];if(t===void 0){const i=vA.get(e);if(i!==void 0)t=tt[i],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,i);else throw new Error("Can not resolve #include <"+e+">")}return Ah(t)}const SA=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function u0(n){return n.replace(SA,MA)}function MA(n,e,t,i){let r="";for(let s=parseInt(e);s<parseInt(t);s++)r+=i.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function d0(n){let e=`precision ${n.precision} float;
	precision ${n.precision} int;
	precision ${n.precision} sampler2D;
	precision ${n.precision} samplerCube;
	precision ${n.precision} sampler3D;
	precision ${n.precision} sampler2DArray;
	precision ${n.precision} sampler2DShadow;
	precision ${n.precision} samplerCubeShadow;
	precision ${n.precision} sampler2DArrayShadow;
	precision ${n.precision} isampler2D;
	precision ${n.precision} isampler3D;
	precision ${n.precision} isamplerCube;
	precision ${n.precision} isampler2DArray;
	precision ${n.precision} usampler2D;
	precision ${n.precision} usampler3D;
	precision ${n.precision} usamplerCube;
	precision ${n.precision} usampler2DArray;
	`;return n.precision==="highp"?e+=`
#define HIGH_PRECISION`:n.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:n.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}function EA(n){let e="SHADOWMAP_TYPE_BASIC";return n.shadowMapType===mv?e="SHADOWMAP_TYPE_PCF":n.shadowMapType===jM?e="SHADOWMAP_TYPE_PCF_SOFT":n.shadowMapType===er&&(e="SHADOWMAP_TYPE_VSM"),e}function wA(n){let e="ENVMAP_TYPE_CUBE";if(n.envMap)switch(n.envMapMode){case Do:case Io:e="ENVMAP_TYPE_CUBE";break;case bu:e="ENVMAP_TYPE_CUBE_UV";break}return e}function TA(n){let e="ENVMAP_MODE_REFLECTION";if(n.envMap)switch(n.envMapMode){case Io:e="ENVMAP_MODE_REFRACTION";break}return e}function bA(n){let e="ENVMAP_BLENDING_NONE";if(n.envMap)switch(n.combine){case gv:e="ENVMAP_BLENDING_MULTIPLY";break;case uE:e="ENVMAP_BLENDING_MIX";break;case dE:e="ENVMAP_BLENDING_ADD";break}return e}function AA(n){const e=n.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,i=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),7*16)),texelHeight:i,maxMip:t}}function RA(n,e,t,i){const r=n.getContext(),s=t.defines;let o=t.vertexShader,a=t.fragmentShader;const l=EA(t),c=wA(t),u=TA(t),d=bA(t),f=AA(t),p=mA(t),g=gA(s),v=r.createProgram();let m,h,_=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(Ra).join(`
`),m.length>0&&(m+=`
`),h=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(Ra).join(`
`),h.length>0&&(h+=`
`)):(m=[d0(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+u:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Ra).join(`
`),h=[d0(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+u:"",t.envMap?"#define "+d:"",f?"#define CUBEUV_TEXEL_WIDTH "+f.texelWidth:"",f?"#define CUBEUV_TEXEL_HEIGHT "+f.texelHeight:"",f?"#define CUBEUV_MAX_MIP "+f.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor||t.batchingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==dr?"#define TONE_MAPPING":"",t.toneMapping!==dr?tt.tonemapping_pars_fragment:"",t.toneMapping!==dr?hA("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",tt.colorspace_pars_fragment,fA("linearToOutputTexel",t.outputColorSpace),pA(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(Ra).join(`
`)),o=Ah(o),o=l0(o,t),o=c0(o,t),a=Ah(a),a=l0(a,t),a=c0(a,t),o=u0(o),a=u0(a),t.isRawShaderMaterial!==!0&&(_=`#version 300 es
`,m=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,h=["#define varying in",t.glslVersion===Ag?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===Ag?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+h);const x=_+m+o,M=_+h+a,L=o0(r,r.VERTEX_SHADER,x),A=o0(r,r.FRAGMENT_SHADER,M);r.attachShader(v,L),r.attachShader(v,A),t.index0AttributeName!==void 0?r.bindAttribLocation(v,0,t.index0AttributeName):t.morphTargets===!0&&r.bindAttribLocation(v,0,"position"),r.linkProgram(v);function T(w){if(n.debug.checkShaderErrors){const X=r.getProgramInfoLog(v).trim(),W=r.getShaderInfoLog(L).trim(),$=r.getShaderInfoLog(A).trim();let se=!0,j=!0;if(r.getProgramParameter(v,r.LINK_STATUS)===!1)if(se=!1,typeof n.debug.onShaderError=="function")n.debug.onShaderError(r,v,L,A);else{const Q=a0(r,L,"vertex"),U=a0(r,A,"fragment");console.error("THREE.WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(v,r.VALIDATE_STATUS)+`

Material Name: `+w.name+`
Material Type: `+w.type+`

Program Info Log: `+X+`
`+Q+`
`+U)}else X!==""?console.warn("THREE.WebGLProgram: Program Info Log:",X):(W===""||$==="")&&(j=!1);j&&(w.diagnostics={runnable:se,programLog:X,vertexShader:{log:W,prefix:m},fragmentShader:{log:$,prefix:h}})}r.deleteShader(L),r.deleteShader(A),I=new Pc(r,v),K=_A(r,v)}let I;this.getUniforms=function(){return I===void 0&&T(this),I};let K;this.getAttributes=function(){return K===void 0&&T(this),K};let y=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return y===!1&&(y=r.getProgramParameter(v,lA)),y},this.destroy=function(){i.releaseStatesOfProgram(this),r.deleteProgram(v),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=cA++,this.cacheKey=e,this.usedTimes=1,this.program=v,this.vertexShader=L,this.fragmentShader=A,this}let CA=0;class PA{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){const t=e.vertexShader,i=e.fragmentShader,r=this._getShaderStage(t),s=this._getShaderStage(i),o=this._getShaderCacheForMaterial(e);return o.has(r)===!1&&(o.add(r),r.usedTimes++),o.has(s)===!1&&(o.add(s),s.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const i of t)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let i=t.get(e);return i===void 0&&(i=new Set,t.set(e,i)),i}_getShaderStage(e){const t=this.shaderCache;let i=t.get(e);return i===void 0&&(i=new LA(e),t.set(e,i)),i}}class LA{constructor(e){this.id=CA++,this.code=e,this.usedTimes=0}}function NA(n,e,t,i,r,s,o){const a=new Bp,l=new PA,c=new Set,u=[],d=r.logarithmicDepthBuffer,f=r.reverseDepthBuffer,p=r.vertexTextures;let g=r.precision;const v={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function m(y){return c.add(y),y===0?"uv":`uv${y}`}function h(y,w,X,W,$){const se=W.fog,j=$.geometry,Q=y.isMeshStandardMaterial?W.environment:null,U=(y.isMeshStandardMaterial?t:e).get(y.envMap||Q),ie=U&&U.mapping===bu?U.image.height:null,re=v[y.type];y.precision!==null&&(g=r.getMaxPrecision(y.precision),g!==y.precision&&console.warn("THREE.WebGLProgram.getParameters:",y.precision,"not supported, using",g,"instead."));const fe=j.morphAttributes.position||j.morphAttributes.normal||j.morphAttributes.color,Oe=fe!==void 0?fe.length:0;let it=0;j.morphAttributes.position!==void 0&&(it=1),j.morphAttributes.normal!==void 0&&(it=2),j.morphAttributes.color!==void 0&&(it=3);let Y,ae,Me,ve;if(re){const ln=Ii[re];Y=ln.vertexShader,ae=ln.fragmentShader}else Y=y.vertexShader,ae=y.fragmentShader,l.update(y),Me=l.getVertexShaderID(y),ve=l.getFragmentShaderID(y);const qe=n.getRenderTarget(),Fe=$.isInstancedMesh===!0,lt=$.isBatchedMesh===!0,ge=!!y.map,Qe=!!y.matcap,D=!!U,mn=!!y.aoMap,Ge=!!y.lightMap,dt=!!y.bumpMap,Ue=!!y.normalMap,St=!!y.displacementMap,ke=!!y.emissiveMap,b=!!y.metalnessMap,S=!!y.roughnessMap,B=y.anisotropy>0,Z=y.clearcoat>0,oe=y.dispersion>0,ee=y.iridescence>0,De=y.sheen>0,pe=y.transmission>0,we=B&&!!y.anisotropyMap,ct=Z&&!!y.clearcoatMap,ce=Z&&!!y.clearcoatNormalMap,Ae=Z&&!!y.clearcoatRoughnessMap,Ye=ee&&!!y.iridescenceMap,We=ee&&!!y.iridescenceThicknessMap,be=De&&!!y.sheenColorMap,rt=De&&!!y.sheenRoughnessMap,je=!!y.specularMap,_t=!!y.specularColorMap,k=!!y.specularIntensityMap,xe=pe&&!!y.transmissionMap,G=pe&&!!y.thicknessMap,te=!!y.gradientMap,ye=!!y.alphaMap,ue=y.alphaTest>0,Je=!!y.alphaHash,At=!!y.extensions;let Yt=dr;y.toneMapped&&(qe===null||qe.isXRRenderTarget===!0)&&(Yt=n.toneMapping);const ut={shaderID:re,shaderType:y.type,shaderName:y.name,vertexShader:Y,fragmentShader:ae,defines:y.defines,customVertexShaderID:Me,customFragmentShaderID:ve,isRawShaderMaterial:y.isRawShaderMaterial===!0,glslVersion:y.glslVersion,precision:g,batching:lt,batchingColor:lt&&$._colorsTexture!==null,instancing:Fe,instancingColor:Fe&&$.instanceColor!==null,instancingMorph:Fe&&$.morphTexture!==null,supportsVertexTextures:p,outputColorSpace:qe===null?n.outputColorSpace:qe.isXRRenderTarget===!0?qe.texture.colorSpace:an,alphaToCoverage:!!y.alphaToCoverage,map:ge,matcap:Qe,envMap:D,envMapMode:D&&U.mapping,envMapCubeUVHeight:ie,aoMap:mn,lightMap:Ge,bumpMap:dt,normalMap:Ue,displacementMap:p&&St,emissiveMap:ke,normalMapObjectSpace:Ue&&y.normalMapType===wE,normalMapTangentSpace:Ue&&y.normalMapType===Cv,metalnessMap:b,roughnessMap:S,anisotropy:B,anisotropyMap:we,clearcoat:Z,clearcoatMap:ct,clearcoatNormalMap:ce,clearcoatRoughnessMap:Ae,dispersion:oe,iridescence:ee,iridescenceMap:Ye,iridescenceThicknessMap:We,sheen:De,sheenColorMap:be,sheenRoughnessMap:rt,specularMap:je,specularColorMap:_t,specularIntensityMap:k,transmission:pe,transmissionMap:xe,thicknessMap:G,gradientMap:te,opaque:y.transparent===!1&&y.blending===So&&y.alphaToCoverage===!1,alphaMap:ye,alphaTest:ue,alphaHash:Je,combine:y.combine,mapUv:ge&&m(y.map.channel),aoMapUv:mn&&m(y.aoMap.channel),lightMapUv:Ge&&m(y.lightMap.channel),bumpMapUv:dt&&m(y.bumpMap.channel),normalMapUv:Ue&&m(y.normalMap.channel),displacementMapUv:St&&m(y.displacementMap.channel),emissiveMapUv:ke&&m(y.emissiveMap.channel),metalnessMapUv:b&&m(y.metalnessMap.channel),roughnessMapUv:S&&m(y.roughnessMap.channel),anisotropyMapUv:we&&m(y.anisotropyMap.channel),clearcoatMapUv:ct&&m(y.clearcoatMap.channel),clearcoatNormalMapUv:ce&&m(y.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Ae&&m(y.clearcoatRoughnessMap.channel),iridescenceMapUv:Ye&&m(y.iridescenceMap.channel),iridescenceThicknessMapUv:We&&m(y.iridescenceThicknessMap.channel),sheenColorMapUv:be&&m(y.sheenColorMap.channel),sheenRoughnessMapUv:rt&&m(y.sheenRoughnessMap.channel),specularMapUv:je&&m(y.specularMap.channel),specularColorMapUv:_t&&m(y.specularColorMap.channel),specularIntensityMapUv:k&&m(y.specularIntensityMap.channel),transmissionMapUv:xe&&m(y.transmissionMap.channel),thicknessMapUv:G&&m(y.thicknessMap.channel),alphaMapUv:ye&&m(y.alphaMap.channel),vertexTangents:!!j.attributes.tangent&&(Ue||B),vertexColors:y.vertexColors,vertexAlphas:y.vertexColors===!0&&!!j.attributes.color&&j.attributes.color.itemSize===4,pointsUvs:$.isPoints===!0&&!!j.attributes.uv&&(ge||ye),fog:!!se,useFog:y.fog===!0,fogExp2:!!se&&se.isFogExp2,flatShading:y.flatShading===!0,sizeAttenuation:y.sizeAttenuation===!0,logarithmicDepthBuffer:d,reverseDepthBuffer:f,skinning:$.isSkinnedMesh===!0,morphTargets:j.morphAttributes.position!==void 0,morphNormals:j.morphAttributes.normal!==void 0,morphColors:j.morphAttributes.color!==void 0,morphTargetsCount:Oe,morphTextureStride:it,numDirLights:w.directional.length,numPointLights:w.point.length,numSpotLights:w.spot.length,numSpotLightMaps:w.spotLightMap.length,numRectAreaLights:w.rectArea.length,numHemiLights:w.hemi.length,numDirLightShadows:w.directionalShadowMap.length,numPointLightShadows:w.pointShadowMap.length,numSpotLightShadows:w.spotShadowMap.length,numSpotLightShadowsWithMaps:w.numSpotLightShadowsWithMaps,numLightProbes:w.numLightProbes,numClippingPlanes:o.numPlanes,numClipIntersection:o.numIntersection,dithering:y.dithering,shadowMapEnabled:n.shadowMap.enabled&&X.length>0,shadowMapType:n.shadowMap.type,toneMapping:Yt,decodeVideoTexture:ge&&y.map.isVideoTexture===!0&&mt.getTransfer(y.map.colorSpace)===Nt,premultipliedAlpha:y.premultipliedAlpha,doubleSided:y.side===ki,flipSided:y.side===Hn,useDepthPacking:y.depthPacking>=0,depthPacking:y.depthPacking||0,index0AttributeName:y.index0AttributeName,extensionClipCullDistance:At&&y.extensions.clipCullDistance===!0&&i.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(At&&y.extensions.multiDraw===!0||lt)&&i.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:i.has("KHR_parallel_shader_compile"),customProgramCacheKey:y.customProgramCacheKey()};return ut.vertexUv1s=c.has(1),ut.vertexUv2s=c.has(2),ut.vertexUv3s=c.has(3),c.clear(),ut}function _(y){const w=[];if(y.shaderID?w.push(y.shaderID):(w.push(y.customVertexShaderID),w.push(y.customFragmentShaderID)),y.defines!==void 0)for(const X in y.defines)w.push(X),w.push(y.defines[X]);return y.isRawShaderMaterial===!1&&(x(w,y),M(w,y),w.push(n.outputColorSpace)),w.push(y.customProgramCacheKey),w.join()}function x(y,w){y.push(w.precision),y.push(w.outputColorSpace),y.push(w.envMapMode),y.push(w.envMapCubeUVHeight),y.push(w.mapUv),y.push(w.alphaMapUv),y.push(w.lightMapUv),y.push(w.aoMapUv),y.push(w.bumpMapUv),y.push(w.normalMapUv),y.push(w.displacementMapUv),y.push(w.emissiveMapUv),y.push(w.metalnessMapUv),y.push(w.roughnessMapUv),y.push(w.anisotropyMapUv),y.push(w.clearcoatMapUv),y.push(w.clearcoatNormalMapUv),y.push(w.clearcoatRoughnessMapUv),y.push(w.iridescenceMapUv),y.push(w.iridescenceThicknessMapUv),y.push(w.sheenColorMapUv),y.push(w.sheenRoughnessMapUv),y.push(w.specularMapUv),y.push(w.specularColorMapUv),y.push(w.specularIntensityMapUv),y.push(w.transmissionMapUv),y.push(w.thicknessMapUv),y.push(w.combine),y.push(w.fogExp2),y.push(w.sizeAttenuation),y.push(w.morphTargetsCount),y.push(w.morphAttributeCount),y.push(w.numDirLights),y.push(w.numPointLights),y.push(w.numSpotLights),y.push(w.numSpotLightMaps),y.push(w.numHemiLights),y.push(w.numRectAreaLights),y.push(w.numDirLightShadows),y.push(w.numPointLightShadows),y.push(w.numSpotLightShadows),y.push(w.numSpotLightShadowsWithMaps),y.push(w.numLightProbes),y.push(w.shadowMapType),y.push(w.toneMapping),y.push(w.numClippingPlanes),y.push(w.numClipIntersection),y.push(w.depthPacking)}function M(y,w){a.disableAll(),w.supportsVertexTextures&&a.enable(0),w.instancing&&a.enable(1),w.instancingColor&&a.enable(2),w.instancingMorph&&a.enable(3),w.matcap&&a.enable(4),w.envMap&&a.enable(5),w.normalMapObjectSpace&&a.enable(6),w.normalMapTangentSpace&&a.enable(7),w.clearcoat&&a.enable(8),w.iridescence&&a.enable(9),w.alphaTest&&a.enable(10),w.vertexColors&&a.enable(11),w.vertexAlphas&&a.enable(12),w.vertexUv1s&&a.enable(13),w.vertexUv2s&&a.enable(14),w.vertexUv3s&&a.enable(15),w.vertexTangents&&a.enable(16),w.anisotropy&&a.enable(17),w.alphaHash&&a.enable(18),w.batching&&a.enable(19),w.dispersion&&a.enable(20),w.batchingColor&&a.enable(21),y.push(a.mask),a.disableAll(),w.fog&&a.enable(0),w.useFog&&a.enable(1),w.flatShading&&a.enable(2),w.logarithmicDepthBuffer&&a.enable(3),w.reverseDepthBuffer&&a.enable(4),w.skinning&&a.enable(5),w.morphTargets&&a.enable(6),w.morphNormals&&a.enable(7),w.morphColors&&a.enable(8),w.premultipliedAlpha&&a.enable(9),w.shadowMapEnabled&&a.enable(10),w.doubleSided&&a.enable(11),w.flipSided&&a.enable(12),w.useDepthPacking&&a.enable(13),w.dithering&&a.enable(14),w.transmission&&a.enable(15),w.sheen&&a.enable(16),w.opaque&&a.enable(17),w.pointsUvs&&a.enable(18),w.decodeVideoTexture&&a.enable(19),w.alphaToCoverage&&a.enable(20),y.push(a.mask)}function L(y){const w=v[y.type];let X;if(w){const W=Ii[w];X=m1.clone(W.uniforms)}else X=y.uniforms;return X}function A(y,w){let X;for(let W=0,$=u.length;W<$;W++){const se=u[W];if(se.cacheKey===w){X=se,++X.usedTimes;break}}return X===void 0&&(X=new RA(n,w,y,s),u.push(X)),X}function T(y){if(--y.usedTimes===0){const w=u.indexOf(y);u[w]=u[u.length-1],u.pop(),y.destroy()}}function I(y){l.remove(y)}function K(){l.dispose()}return{getParameters:h,getProgramCacheKey:_,getUniforms:L,acquireProgram:A,releaseProgram:T,releaseShaderCache:I,programs:u,dispose:K}}function DA(){let n=new WeakMap;function e(o){return n.has(o)}function t(o){let a=n.get(o);return a===void 0&&(a={},n.set(o,a)),a}function i(o){n.delete(o)}function r(o,a,l){n.get(o)[a]=l}function s(){n=new WeakMap}return{has:e,get:t,remove:i,update:r,dispose:s}}function IA(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.material.id!==e.material.id?n.material.id-e.material.id:n.z!==e.z?n.z-e.z:n.id-e.id}function f0(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.z!==e.z?e.z-n.z:n.id-e.id}function h0(){const n=[];let e=0;const t=[],i=[],r=[];function s(){e=0,t.length=0,i.length=0,r.length=0}function o(d,f,p,g,v,m){let h=n[e];return h===void 0?(h={id:d.id,object:d,geometry:f,material:p,groupOrder:g,renderOrder:d.renderOrder,z:v,group:m},n[e]=h):(h.id=d.id,h.object=d,h.geometry=f,h.material=p,h.groupOrder=g,h.renderOrder=d.renderOrder,h.z=v,h.group=m),e++,h}function a(d,f,p,g,v,m){const h=o(d,f,p,g,v,m);p.transmission>0?i.push(h):p.transparent===!0?r.push(h):t.push(h)}function l(d,f,p,g,v,m){const h=o(d,f,p,g,v,m);p.transmission>0?i.unshift(h):p.transparent===!0?r.unshift(h):t.unshift(h)}function c(d,f){t.length>1&&t.sort(d||IA),i.length>1&&i.sort(f||f0),r.length>1&&r.sort(f||f0)}function u(){for(let d=e,f=n.length;d<f;d++){const p=n[d];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.group=null}}return{opaque:t,transmissive:i,transparent:r,init:s,push:a,unshift:l,finish:u,sort:c}}function UA(){let n=new WeakMap;function e(i,r){const s=n.get(i);let o;return s===void 0?(o=new h0,n.set(i,[o])):r>=s.length?(o=new h0,s.push(o)):o=s[r],o}function t(){n=new WeakMap}return{get:e,dispose:t}}function kA(){const n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new N,color:new Ke};break;case"SpotLight":t={position:new N,direction:new N,color:new Ke,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new N,color:new Ke,distance:0,decay:0};break;case"HemisphereLight":t={direction:new N,skyColor:new Ke,groundColor:new Ke};break;case"RectAreaLight":t={color:new Ke,position:new N,halfWidth:new N,halfHeight:new N};break}return n[e.id]=t,t}}}function OA(){const n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new He};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new He};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new He,shadowCameraNear:1,shadowCameraFar:1e3};break}return n[e.id]=t,t}}}let FA=0;function BA(n,e){return(e.castShadow?2:0)-(n.castShadow?2:0)+(e.map?1:0)-(n.map?1:0)}function zA(n){const e=new kA,t=OA(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new N);const r=new N,s=new Ze,o=new Ze;function a(c){let u=0,d=0,f=0;for(let K=0;K<9;K++)i.probe[K].set(0,0,0);let p=0,g=0,v=0,m=0,h=0,_=0,x=0,M=0,L=0,A=0,T=0;c.sort(BA);for(let K=0,y=c.length;K<y;K++){const w=c[K],X=w.color,W=w.intensity,$=w.distance,se=w.shadow&&w.shadow.map?w.shadow.map.texture:null;if(w.isAmbientLight)u+=X.r*W,d+=X.g*W,f+=X.b*W;else if(w.isLightProbe){for(let j=0;j<9;j++)i.probe[j].addScaledVector(w.sh.coefficients[j],W);T++}else if(w.isDirectionalLight){const j=e.get(w);if(j.color.copy(w.color).multiplyScalar(w.intensity),w.castShadow){const Q=w.shadow,U=t.get(w);U.shadowIntensity=Q.intensity,U.shadowBias=Q.bias,U.shadowNormalBias=Q.normalBias,U.shadowRadius=Q.radius,U.shadowMapSize=Q.mapSize,i.directionalShadow[p]=U,i.directionalShadowMap[p]=se,i.directionalShadowMatrix[p]=w.shadow.matrix,_++}i.directional[p]=j,p++}else if(w.isSpotLight){const j=e.get(w);j.position.setFromMatrixPosition(w.matrixWorld),j.color.copy(X).multiplyScalar(W),j.distance=$,j.coneCos=Math.cos(w.angle),j.penumbraCos=Math.cos(w.angle*(1-w.penumbra)),j.decay=w.decay,i.spot[v]=j;const Q=w.shadow;if(w.map&&(i.spotLightMap[L]=w.map,L++,Q.updateMatrices(w),w.castShadow&&A++),i.spotLightMatrix[v]=Q.matrix,w.castShadow){const U=t.get(w);U.shadowIntensity=Q.intensity,U.shadowBias=Q.bias,U.shadowNormalBias=Q.normalBias,U.shadowRadius=Q.radius,U.shadowMapSize=Q.mapSize,i.spotShadow[v]=U,i.spotShadowMap[v]=se,M++}v++}else if(w.isRectAreaLight){const j=e.get(w);j.color.copy(X).multiplyScalar(W),j.halfWidth.set(w.width*.5,0,0),j.halfHeight.set(0,w.height*.5,0),i.rectArea[m]=j,m++}else if(w.isPointLight){const j=e.get(w);if(j.color.copy(w.color).multiplyScalar(w.intensity),j.distance=w.distance,j.decay=w.decay,w.castShadow){const Q=w.shadow,U=t.get(w);U.shadowIntensity=Q.intensity,U.shadowBias=Q.bias,U.shadowNormalBias=Q.normalBias,U.shadowRadius=Q.radius,U.shadowMapSize=Q.mapSize,U.shadowCameraNear=Q.camera.near,U.shadowCameraFar=Q.camera.far,i.pointShadow[g]=U,i.pointShadowMap[g]=se,i.pointShadowMatrix[g]=w.shadow.matrix,x++}i.point[g]=j,g++}else if(w.isHemisphereLight){const j=e.get(w);j.skyColor.copy(w.color).multiplyScalar(W),j.groundColor.copy(w.groundColor).multiplyScalar(W),i.hemi[h]=j,h++}}m>0&&(n.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=_e.LTC_FLOAT_1,i.rectAreaLTC2=_e.LTC_FLOAT_2):(i.rectAreaLTC1=_e.LTC_HALF_1,i.rectAreaLTC2=_e.LTC_HALF_2)),i.ambient[0]=u,i.ambient[1]=d,i.ambient[2]=f;const I=i.hash;(I.directionalLength!==p||I.pointLength!==g||I.spotLength!==v||I.rectAreaLength!==m||I.hemiLength!==h||I.numDirectionalShadows!==_||I.numPointShadows!==x||I.numSpotShadows!==M||I.numSpotMaps!==L||I.numLightProbes!==T)&&(i.directional.length=p,i.spot.length=v,i.rectArea.length=m,i.point.length=g,i.hemi.length=h,i.directionalShadow.length=_,i.directionalShadowMap.length=_,i.pointShadow.length=x,i.pointShadowMap.length=x,i.spotShadow.length=M,i.spotShadowMap.length=M,i.directionalShadowMatrix.length=_,i.pointShadowMatrix.length=x,i.spotLightMatrix.length=M+L-A,i.spotLightMap.length=L,i.numSpotLightShadowsWithMaps=A,i.numLightProbes=T,I.directionalLength=p,I.pointLength=g,I.spotLength=v,I.rectAreaLength=m,I.hemiLength=h,I.numDirectionalShadows=_,I.numPointShadows=x,I.numSpotShadows=M,I.numSpotMaps=L,I.numLightProbes=T,i.version=FA++)}function l(c,u){let d=0,f=0,p=0,g=0,v=0;const m=u.matrixWorldInverse;for(let h=0,_=c.length;h<_;h++){const x=c[h];if(x.isDirectionalLight){const M=i.directional[d];M.direction.setFromMatrixPosition(x.matrixWorld),r.setFromMatrixPosition(x.target.matrixWorld),M.direction.sub(r),M.direction.transformDirection(m),d++}else if(x.isSpotLight){const M=i.spot[p];M.position.setFromMatrixPosition(x.matrixWorld),M.position.applyMatrix4(m),M.direction.setFromMatrixPosition(x.matrixWorld),r.setFromMatrixPosition(x.target.matrixWorld),M.direction.sub(r),M.direction.transformDirection(m),p++}else if(x.isRectAreaLight){const M=i.rectArea[g];M.position.setFromMatrixPosition(x.matrixWorld),M.position.applyMatrix4(m),o.identity(),s.copy(x.matrixWorld),s.premultiply(m),o.extractRotation(s),M.halfWidth.set(x.width*.5,0,0),M.halfHeight.set(0,x.height*.5,0),M.halfWidth.applyMatrix4(o),M.halfHeight.applyMatrix4(o),g++}else if(x.isPointLight){const M=i.point[f];M.position.setFromMatrixPosition(x.matrixWorld),M.position.applyMatrix4(m),f++}else if(x.isHemisphereLight){const M=i.hemi[v];M.direction.setFromMatrixPosition(x.matrixWorld),M.direction.transformDirection(m),v++}}}return{setup:a,setupView:l,state:i}}function p0(n){const e=new zA(n),t=[],i=[];function r(u){c.camera=u,t.length=0,i.length=0}function s(u){t.push(u)}function o(u){i.push(u)}function a(){e.setup(t)}function l(u){e.setupView(t,u)}const c={lightsArray:t,shadowsArray:i,camera:null,lights:e,transmissionRenderTarget:{}};return{init:r,state:c,setupLights:a,setupLightsView:l,pushLight:s,pushShadow:o}}function HA(n){let e=new WeakMap;function t(r,s=0){const o=e.get(r);let a;return o===void 0?(a=new p0(n),e.set(r,[a])):s>=o.length?(a=new p0(n),o.push(a)):a=o[s],a}function i(){e=new WeakMap}return{get:t,dispose:i}}class VA extends zi{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=ME,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class GA extends zi{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}const WA=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,jA=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function XA(n,e,t){let i=new zp;const r=new He,s=new He,o=new yt,a=new VA({depthPacking:EE}),l=new GA,c={},u=t.maxTextureSize,d={[Hi]:Hn,[Hn]:Hi,[ki]:ki},f=new qr({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new He},radius:{value:4}},vertexShader:WA,fragmentShader:jA}),p=f.clone();p.defines.HORIZONTAL_PASS=1;const g=new di;g.setAttribute("position",new hn(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const v=new Yn(g,f),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=mv;let h=this.type;this.render=function(A,T,I){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||A.length===0)return;const K=n.getRenderTarget(),y=n.getActiveCubeFace(),w=n.getActiveMipmapLevel(),X=n.state;X.setBlending(Xr),X.buffers.color.setClear(1,1,1,1),X.buffers.depth.setTest(!0),X.setScissorTest(!1);const W=h!==er&&this.type===er,$=h===er&&this.type!==er;for(let se=0,j=A.length;se<j;se++){const Q=A[se],U=Q.shadow;if(U===void 0){console.warn("THREE.WebGLShadowMap:",Q,"has no shadow.");continue}if(U.autoUpdate===!1&&U.needsUpdate===!1)continue;r.copy(U.mapSize);const ie=U.getFrameExtents();if(r.multiply(ie),s.copy(U.mapSize),(r.x>u||r.y>u)&&(r.x>u&&(s.x=Math.floor(u/ie.x),r.x=s.x*ie.x,U.mapSize.x=s.x),r.y>u&&(s.y=Math.floor(u/ie.y),r.y=s.y*ie.y,U.mapSize.y=s.y)),U.map===null||W===!0||$===!0){const fe=this.type!==er?{minFilter:An,magFilter:An}:{};U.map!==null&&U.map.dispose(),U.map=new Ps(r.x,r.y,fe),U.map.texture.name=Q.name+".shadowMap",U.camera.updateProjectionMatrix()}n.setRenderTarget(U.map),n.clear();const re=U.getViewportCount();for(let fe=0;fe<re;fe++){const Oe=U.getViewport(fe);o.set(s.x*Oe.x,s.y*Oe.y,s.x*Oe.z,s.y*Oe.w),X.viewport(o),U.updateMatrices(Q,fe),i=U.getFrustum(),M(T,I,U.camera,Q,this.type)}U.isPointLightShadow!==!0&&this.type===er&&_(U,I),U.needsUpdate=!1}h=this.type,m.needsUpdate=!1,n.setRenderTarget(K,y,w)};function _(A,T){const I=e.update(v);f.defines.VSM_SAMPLES!==A.blurSamples&&(f.defines.VSM_SAMPLES=A.blurSamples,p.defines.VSM_SAMPLES=A.blurSamples,f.needsUpdate=!0,p.needsUpdate=!0),A.mapPass===null&&(A.mapPass=new Ps(r.x,r.y)),f.uniforms.shadow_pass.value=A.map.texture,f.uniforms.resolution.value=A.mapSize,f.uniforms.radius.value=A.radius,n.setRenderTarget(A.mapPass),n.clear(),n.renderBufferDirect(T,null,I,f,v,null),p.uniforms.shadow_pass.value=A.mapPass.texture,p.uniforms.resolution.value=A.mapSize,p.uniforms.radius.value=A.radius,n.setRenderTarget(A.map),n.clear(),n.renderBufferDirect(T,null,I,p,v,null)}function x(A,T,I,K){let y=null;const w=I.isPointLight===!0?A.customDistanceMaterial:A.customDepthMaterial;if(w!==void 0)y=w;else if(y=I.isPointLight===!0?l:a,n.localClippingEnabled&&T.clipShadows===!0&&Array.isArray(T.clippingPlanes)&&T.clippingPlanes.length!==0||T.displacementMap&&T.displacementScale!==0||T.alphaMap&&T.alphaTest>0||T.map&&T.alphaTest>0){const X=y.uuid,W=T.uuid;let $=c[X];$===void 0&&($={},c[X]=$);let se=$[W];se===void 0&&(se=y.clone(),$[W]=se,T.addEventListener("dispose",L)),y=se}if(y.visible=T.visible,y.wireframe=T.wireframe,K===er?y.side=T.shadowSide!==null?T.shadowSide:T.side:y.side=T.shadowSide!==null?T.shadowSide:d[T.side],y.alphaMap=T.alphaMap,y.alphaTest=T.alphaTest,y.map=T.map,y.clipShadows=T.clipShadows,y.clippingPlanes=T.clippingPlanes,y.clipIntersection=T.clipIntersection,y.displacementMap=T.displacementMap,y.displacementScale=T.displacementScale,y.displacementBias=T.displacementBias,y.wireframeLinewidth=T.wireframeLinewidth,y.linewidth=T.linewidth,I.isPointLight===!0&&y.isMeshDistanceMaterial===!0){const X=n.properties.get(y);X.light=I}return y}function M(A,T,I,K,y){if(A.visible===!1)return;if(A.layers.test(T.layers)&&(A.isMesh||A.isLine||A.isPoints)&&(A.castShadow||A.receiveShadow&&y===er)&&(!A.frustumCulled||i.intersectsObject(A))){A.modelViewMatrix.multiplyMatrices(I.matrixWorldInverse,A.matrixWorld);const W=e.update(A),$=A.material;if(Array.isArray($)){const se=W.groups;for(let j=0,Q=se.length;j<Q;j++){const U=se[j],ie=$[U.materialIndex];if(ie&&ie.visible){const re=x(A,ie,K,y);A.onBeforeShadow(n,A,T,I,W,re,U),n.renderBufferDirect(I,null,W,re,A,U),A.onAfterShadow(n,A,T,I,W,re,U)}}}else if($.visible){const se=x(A,$,K,y);A.onBeforeShadow(n,A,T,I,W,se,null),n.renderBufferDirect(I,null,W,se,A,null),A.onAfterShadow(n,A,T,I,W,se,null)}}const X=A.children;for(let W=0,$=X.length;W<$;W++)M(X[W],T,I,K,y)}function L(A){A.target.removeEventListener("dispose",L);for(const I in c){const K=c[I],y=A.target.uuid;y in K&&(K[y].dispose(),delete K[y])}}}const YA={[Wf]:jf,[Xf]:qf,[Yf]:$f,[No]:Kf,[jf]:Wf,[qf]:Xf,[$f]:Yf,[Kf]:No};function KA(n){function e(){let k=!1;const xe=new yt;let G=null;const te=new yt(0,0,0,0);return{setMask:function(ye){G!==ye&&!k&&(n.colorMask(ye,ye,ye,ye),G=ye)},setLocked:function(ye){k=ye},setClear:function(ye,ue,Je,At,Yt){Yt===!0&&(ye*=At,ue*=At,Je*=At),xe.set(ye,ue,Je,At),te.equals(xe)===!1&&(n.clearColor(ye,ue,Je,At),te.copy(xe))},reset:function(){k=!1,G=null,te.set(-1,0,0,0)}}}function t(){let k=!1,xe=!1,G=null,te=null,ye=null;return{setReversed:function(ue){xe=ue},setTest:function(ue){ue?Me(n.DEPTH_TEST):ve(n.DEPTH_TEST)},setMask:function(ue){G!==ue&&!k&&(n.depthMask(ue),G=ue)},setFunc:function(ue){if(xe&&(ue=YA[ue]),te!==ue){switch(ue){case Wf:n.depthFunc(n.NEVER);break;case jf:n.depthFunc(n.ALWAYS);break;case Xf:n.depthFunc(n.LESS);break;case No:n.depthFunc(n.LEQUAL);break;case Yf:n.depthFunc(n.EQUAL);break;case Kf:n.depthFunc(n.GEQUAL);break;case qf:n.depthFunc(n.GREATER);break;case $f:n.depthFunc(n.NOTEQUAL);break;default:n.depthFunc(n.LEQUAL)}te=ue}},setLocked:function(ue){k=ue},setClear:function(ue){ye!==ue&&(n.clearDepth(ue),ye=ue)},reset:function(){k=!1,G=null,te=null,ye=null}}}function i(){let k=!1,xe=null,G=null,te=null,ye=null,ue=null,Je=null,At=null,Yt=null;return{setTest:function(ut){k||(ut?Me(n.STENCIL_TEST):ve(n.STENCIL_TEST))},setMask:function(ut){xe!==ut&&!k&&(n.stencilMask(ut),xe=ut)},setFunc:function(ut,ln,Ln){(G!==ut||te!==ln||ye!==Ln)&&(n.stencilFunc(ut,ln,Ln),G=ut,te=ln,ye=Ln)},setOp:function(ut,ln,Ln){(ue!==ut||Je!==ln||At!==Ln)&&(n.stencilOp(ut,ln,Ln),ue=ut,Je=ln,At=Ln)},setLocked:function(ut){k=ut},setClear:function(ut){Yt!==ut&&(n.clearStencil(ut),Yt=ut)},reset:function(){k=!1,xe=null,G=null,te=null,ye=null,ue=null,Je=null,At=null,Yt=null}}}const r=new e,s=new t,o=new i,a=new WeakMap,l=new WeakMap;let c={},u={},d=new WeakMap,f=[],p=null,g=!1,v=null,m=null,h=null,_=null,x=null,M=null,L=null,A=new Ke(0,0,0),T=0,I=!1,K=null,y=null,w=null,X=null,W=null;const $=n.getParameter(n.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let se=!1,j=0;const Q=n.getParameter(n.VERSION);Q.indexOf("WebGL")!==-1?(j=parseFloat(/^WebGL (\d)/.exec(Q)[1]),se=j>=1):Q.indexOf("OpenGL ES")!==-1&&(j=parseFloat(/^OpenGL ES (\d)/.exec(Q)[1]),se=j>=2);let U=null,ie={};const re=n.getParameter(n.SCISSOR_BOX),fe=n.getParameter(n.VIEWPORT),Oe=new yt().fromArray(re),it=new yt().fromArray(fe);function Y(k,xe,G,te){const ye=new Uint8Array(4),ue=n.createTexture();n.bindTexture(k,ue),n.texParameteri(k,n.TEXTURE_MIN_FILTER,n.NEAREST),n.texParameteri(k,n.TEXTURE_MAG_FILTER,n.NEAREST);for(let Je=0;Je<G;Je++)k===n.TEXTURE_3D||k===n.TEXTURE_2D_ARRAY?n.texImage3D(xe,0,n.RGBA,1,1,te,0,n.RGBA,n.UNSIGNED_BYTE,ye):n.texImage2D(xe+Je,0,n.RGBA,1,1,0,n.RGBA,n.UNSIGNED_BYTE,ye);return ue}const ae={};ae[n.TEXTURE_2D]=Y(n.TEXTURE_2D,n.TEXTURE_2D,1),ae[n.TEXTURE_CUBE_MAP]=Y(n.TEXTURE_CUBE_MAP,n.TEXTURE_CUBE_MAP_POSITIVE_X,6),ae[n.TEXTURE_2D_ARRAY]=Y(n.TEXTURE_2D_ARRAY,n.TEXTURE_2D_ARRAY,1,1),ae[n.TEXTURE_3D]=Y(n.TEXTURE_3D,n.TEXTURE_3D,1,1),r.setClear(0,0,0,1),s.setClear(1),o.setClear(0),Me(n.DEPTH_TEST),s.setFunc(No),Ge(!1),dt(xg),Me(n.CULL_FACE),D(Xr);function Me(k){c[k]!==!0&&(n.enable(k),c[k]=!0)}function ve(k){c[k]!==!1&&(n.disable(k),c[k]=!1)}function qe(k,xe){return u[k]!==xe?(n.bindFramebuffer(k,xe),u[k]=xe,k===n.DRAW_FRAMEBUFFER&&(u[n.FRAMEBUFFER]=xe),k===n.FRAMEBUFFER&&(u[n.DRAW_FRAMEBUFFER]=xe),!0):!1}function Fe(k,xe){let G=f,te=!1;if(k){G=d.get(xe),G===void 0&&(G=[],d.set(xe,G));const ye=k.textures;if(G.length!==ye.length||G[0]!==n.COLOR_ATTACHMENT0){for(let ue=0,Je=ye.length;ue<Je;ue++)G[ue]=n.COLOR_ATTACHMENT0+ue;G.length=ye.length,te=!0}}else G[0]!==n.BACK&&(G[0]=n.BACK,te=!0);te&&n.drawBuffers(G)}function lt(k){return p!==k?(n.useProgram(k),p=k,!0):!1}const ge={[gs]:n.FUNC_ADD,[YM]:n.FUNC_SUBTRACT,[KM]:n.FUNC_REVERSE_SUBTRACT};ge[qM]=n.MIN,ge[$M]=n.MAX;const Qe={[ZM]:n.ZERO,[JM]:n.ONE,[QM]:n.SRC_COLOR,[Vf]:n.SRC_ALPHA,[sE]:n.SRC_ALPHA_SATURATE,[iE]:n.DST_COLOR,[tE]:n.DST_ALPHA,[eE]:n.ONE_MINUS_SRC_COLOR,[Gf]:n.ONE_MINUS_SRC_ALPHA,[rE]:n.ONE_MINUS_DST_COLOR,[nE]:n.ONE_MINUS_DST_ALPHA,[oE]:n.CONSTANT_COLOR,[aE]:n.ONE_MINUS_CONSTANT_COLOR,[lE]:n.CONSTANT_ALPHA,[cE]:n.ONE_MINUS_CONSTANT_ALPHA};function D(k,xe,G,te,ye,ue,Je,At,Yt,ut){if(k===Xr){g===!0&&(ve(n.BLEND),g=!1);return}if(g===!1&&(Me(n.BLEND),g=!0),k!==XM){if(k!==v||ut!==I){if((m!==gs||x!==gs)&&(n.blendEquation(n.FUNC_ADD),m=gs,x=gs),ut)switch(k){case So:n.blendFuncSeparate(n.ONE,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case vg:n.blendFunc(n.ONE,n.ONE);break;case yg:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case Sg:n.blendFuncSeparate(n.ZERO,n.SRC_COLOR,n.ZERO,n.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",k);break}else switch(k){case So:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case vg:n.blendFunc(n.SRC_ALPHA,n.ONE);break;case yg:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case Sg:n.blendFunc(n.ZERO,n.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",k);break}h=null,_=null,M=null,L=null,A.set(0,0,0),T=0,v=k,I=ut}return}ye=ye||xe,ue=ue||G,Je=Je||te,(xe!==m||ye!==x)&&(n.blendEquationSeparate(ge[xe],ge[ye]),m=xe,x=ye),(G!==h||te!==_||ue!==M||Je!==L)&&(n.blendFuncSeparate(Qe[G],Qe[te],Qe[ue],Qe[Je]),h=G,_=te,M=ue,L=Je),(At.equals(A)===!1||Yt!==T)&&(n.blendColor(At.r,At.g,At.b,Yt),A.copy(At),T=Yt),v=k,I=!1}function mn(k,xe){k.side===ki?ve(n.CULL_FACE):Me(n.CULL_FACE);let G=k.side===Hn;xe&&(G=!G),Ge(G),k.blending===So&&k.transparent===!1?D(Xr):D(k.blending,k.blendEquation,k.blendSrc,k.blendDst,k.blendEquationAlpha,k.blendSrcAlpha,k.blendDstAlpha,k.blendColor,k.blendAlpha,k.premultipliedAlpha),s.setFunc(k.depthFunc),s.setTest(k.depthTest),s.setMask(k.depthWrite),r.setMask(k.colorWrite);const te=k.stencilWrite;o.setTest(te),te&&(o.setMask(k.stencilWriteMask),o.setFunc(k.stencilFunc,k.stencilRef,k.stencilFuncMask),o.setOp(k.stencilFail,k.stencilZFail,k.stencilZPass)),St(k.polygonOffset,k.polygonOffsetFactor,k.polygonOffsetUnits),k.alphaToCoverage===!0?Me(n.SAMPLE_ALPHA_TO_COVERAGE):ve(n.SAMPLE_ALPHA_TO_COVERAGE)}function Ge(k){K!==k&&(k?n.frontFace(n.CW):n.frontFace(n.CCW),K=k)}function dt(k){k!==GM?(Me(n.CULL_FACE),k!==y&&(k===xg?n.cullFace(n.BACK):k===WM?n.cullFace(n.FRONT):n.cullFace(n.FRONT_AND_BACK))):ve(n.CULL_FACE),y=k}function Ue(k){k!==w&&(se&&n.lineWidth(k),w=k)}function St(k,xe,G){k?(Me(n.POLYGON_OFFSET_FILL),(X!==xe||W!==G)&&(n.polygonOffset(xe,G),X=xe,W=G)):ve(n.POLYGON_OFFSET_FILL)}function ke(k){k?Me(n.SCISSOR_TEST):ve(n.SCISSOR_TEST)}function b(k){k===void 0&&(k=n.TEXTURE0+$-1),U!==k&&(n.activeTexture(k),U=k)}function S(k,xe,G){G===void 0&&(U===null?G=n.TEXTURE0+$-1:G=U);let te=ie[G];te===void 0&&(te={type:void 0,texture:void 0},ie[G]=te),(te.type!==k||te.texture!==xe)&&(U!==G&&(n.activeTexture(G),U=G),n.bindTexture(k,xe||ae[k]),te.type=k,te.texture=xe)}function B(){const k=ie[U];k!==void 0&&k.type!==void 0&&(n.bindTexture(k.type,null),k.type=void 0,k.texture=void 0)}function Z(){try{n.compressedTexImage2D.apply(n,arguments)}catch(k){console.error("THREE.WebGLState:",k)}}function oe(){try{n.compressedTexImage3D.apply(n,arguments)}catch(k){console.error("THREE.WebGLState:",k)}}function ee(){try{n.texSubImage2D.apply(n,arguments)}catch(k){console.error("THREE.WebGLState:",k)}}function De(){try{n.texSubImage3D.apply(n,arguments)}catch(k){console.error("THREE.WebGLState:",k)}}function pe(){try{n.compressedTexSubImage2D.apply(n,arguments)}catch(k){console.error("THREE.WebGLState:",k)}}function we(){try{n.compressedTexSubImage3D.apply(n,arguments)}catch(k){console.error("THREE.WebGLState:",k)}}function ct(){try{n.texStorage2D.apply(n,arguments)}catch(k){console.error("THREE.WebGLState:",k)}}function ce(){try{n.texStorage3D.apply(n,arguments)}catch(k){console.error("THREE.WebGLState:",k)}}function Ae(){try{n.texImage2D.apply(n,arguments)}catch(k){console.error("THREE.WebGLState:",k)}}function Ye(){try{n.texImage3D.apply(n,arguments)}catch(k){console.error("THREE.WebGLState:",k)}}function We(k){Oe.equals(k)===!1&&(n.scissor(k.x,k.y,k.z,k.w),Oe.copy(k))}function be(k){it.equals(k)===!1&&(n.viewport(k.x,k.y,k.z,k.w),it.copy(k))}function rt(k,xe){let G=l.get(xe);G===void 0&&(G=new WeakMap,l.set(xe,G));let te=G.get(k);te===void 0&&(te=n.getUniformBlockIndex(xe,k.name),G.set(k,te))}function je(k,xe){const te=l.get(xe).get(k);a.get(xe)!==te&&(n.uniformBlockBinding(xe,te,k.__bindingPointIndex),a.set(xe,te))}function _t(){n.disable(n.BLEND),n.disable(n.CULL_FACE),n.disable(n.DEPTH_TEST),n.disable(n.POLYGON_OFFSET_FILL),n.disable(n.SCISSOR_TEST),n.disable(n.STENCIL_TEST),n.disable(n.SAMPLE_ALPHA_TO_COVERAGE),n.blendEquation(n.FUNC_ADD),n.blendFunc(n.ONE,n.ZERO),n.blendFuncSeparate(n.ONE,n.ZERO,n.ONE,n.ZERO),n.blendColor(0,0,0,0),n.colorMask(!0,!0,!0,!0),n.clearColor(0,0,0,0),n.depthMask(!0),n.depthFunc(n.LESS),n.clearDepth(1),n.stencilMask(4294967295),n.stencilFunc(n.ALWAYS,0,4294967295),n.stencilOp(n.KEEP,n.KEEP,n.KEEP),n.clearStencil(0),n.cullFace(n.BACK),n.frontFace(n.CCW),n.polygonOffset(0,0),n.activeTexture(n.TEXTURE0),n.bindFramebuffer(n.FRAMEBUFFER,null),n.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),n.bindFramebuffer(n.READ_FRAMEBUFFER,null),n.useProgram(null),n.lineWidth(1),n.scissor(0,0,n.canvas.width,n.canvas.height),n.viewport(0,0,n.canvas.width,n.canvas.height),c={},U=null,ie={},u={},d=new WeakMap,f=[],p=null,g=!1,v=null,m=null,h=null,_=null,x=null,M=null,L=null,A=new Ke(0,0,0),T=0,I=!1,K=null,y=null,w=null,X=null,W=null,Oe.set(0,0,n.canvas.width,n.canvas.height),it.set(0,0,n.canvas.width,n.canvas.height),r.reset(),s.reset(),o.reset()}return{buffers:{color:r,depth:s,stencil:o},enable:Me,disable:ve,bindFramebuffer:qe,drawBuffers:Fe,useProgram:lt,setBlending:D,setMaterial:mn,setFlipSided:Ge,setCullFace:dt,setLineWidth:Ue,setPolygonOffset:St,setScissorTest:ke,activeTexture:b,bindTexture:S,unbindTexture:B,compressedTexImage2D:Z,compressedTexImage3D:oe,texImage2D:Ae,texImage3D:Ye,updateUBOMapping:rt,uniformBlockBinding:je,texStorage2D:ct,texStorage3D:ce,texSubImage2D:ee,texSubImage3D:De,compressedTexSubImage2D:pe,compressedTexSubImage3D:we,scissor:We,viewport:be,reset:_t}}function m0(n,e,t,i){const r=qA(i);switch(t){case Mv:return n*e;case wv:return n*e;case Tv:return n*e*2;case Dp:return n*e/r.components*r.byteLength;case Ip:return n*e/r.components*r.byteLength;case bv:return n*e*2/r.components*r.byteLength;case Up:return n*e*2/r.components*r.byteLength;case Ev:return n*e*3/r.components*r.byteLength;case ai:return n*e*4/r.components*r.byteLength;case kp:return n*e*4/r.components*r.byteLength;case wc:case Tc:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case bc:case Ac:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case eh:case nh:return Math.max(n,16)*Math.max(e,8)/4;case Qf:case th:return Math.max(n,8)*Math.max(e,8)/2;case ih:case rh:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case sh:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case oh:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case ah:return Math.floor((n+4)/5)*Math.floor((e+3)/4)*16;case lh:return Math.floor((n+4)/5)*Math.floor((e+4)/5)*16;case ch:return Math.floor((n+5)/6)*Math.floor((e+4)/5)*16;case uh:return Math.floor((n+5)/6)*Math.floor((e+5)/6)*16;case dh:return Math.floor((n+7)/8)*Math.floor((e+4)/5)*16;case fh:return Math.floor((n+7)/8)*Math.floor((e+5)/6)*16;case hh:return Math.floor((n+7)/8)*Math.floor((e+7)/8)*16;case ph:return Math.floor((n+9)/10)*Math.floor((e+4)/5)*16;case mh:return Math.floor((n+9)/10)*Math.floor((e+5)/6)*16;case gh:return Math.floor((n+9)/10)*Math.floor((e+7)/8)*16;case _h:return Math.floor((n+9)/10)*Math.floor((e+9)/10)*16;case xh:return Math.floor((n+11)/12)*Math.floor((e+9)/10)*16;case vh:return Math.floor((n+11)/12)*Math.floor((e+11)/12)*16;case Rc:case yh:case Sh:return Math.ceil(n/4)*Math.ceil(e/4)*16;case Av:case Mh:return Math.ceil(n/4)*Math.ceil(e/4)*8;case Eh:case wh:return Math.ceil(n/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function qA(n){switch(n){case gr:case vv:return{byteLength:1,components:1};case rl:case yv:case hl:return{byteLength:2,components:1};case Lp:case Np:return{byteLength:2,components:4};case Cs:case Pp:case Mi:return{byteLength:4,components:1};case Sv:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${n}.`)}function $A(n,e,t,i,r,s,o){const a=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new He,u=new WeakMap;let d;const f=new WeakMap;let p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(b,S){return p?new OffscreenCanvas(b,S):al("canvas")}function v(b,S,B){let Z=1;const oe=ke(b);if((oe.width>B||oe.height>B)&&(Z=B/Math.max(oe.width,oe.height)),Z<1)if(typeof HTMLImageElement<"u"&&b instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&b instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&b instanceof ImageBitmap||typeof VideoFrame<"u"&&b instanceof VideoFrame){const ee=Math.floor(Z*oe.width),De=Math.floor(Z*oe.height);d===void 0&&(d=g(ee,De));const pe=S?g(ee,De):d;return pe.width=ee,pe.height=De,pe.getContext("2d").drawImage(b,0,0,ee,De),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+oe.width+"x"+oe.height+") to ("+ee+"x"+De+")."),pe}else return"data"in b&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+oe.width+"x"+oe.height+")."),b;return b}function m(b){return b.generateMipmaps&&b.minFilter!==An&&b.minFilter!==kn}function h(b){n.generateMipmap(b)}function _(b,S,B,Z,oe=!1){if(b!==null){if(n[b]!==void 0)return n[b];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+b+"'")}let ee=S;if(S===n.RED&&(B===n.FLOAT&&(ee=n.R32F),B===n.HALF_FLOAT&&(ee=n.R16F),B===n.UNSIGNED_BYTE&&(ee=n.R8)),S===n.RED_INTEGER&&(B===n.UNSIGNED_BYTE&&(ee=n.R8UI),B===n.UNSIGNED_SHORT&&(ee=n.R16UI),B===n.UNSIGNED_INT&&(ee=n.R32UI),B===n.BYTE&&(ee=n.R8I),B===n.SHORT&&(ee=n.R16I),B===n.INT&&(ee=n.R32I)),S===n.RG&&(B===n.FLOAT&&(ee=n.RG32F),B===n.HALF_FLOAT&&(ee=n.RG16F),B===n.UNSIGNED_BYTE&&(ee=n.RG8)),S===n.RG_INTEGER&&(B===n.UNSIGNED_BYTE&&(ee=n.RG8UI),B===n.UNSIGNED_SHORT&&(ee=n.RG16UI),B===n.UNSIGNED_INT&&(ee=n.RG32UI),B===n.BYTE&&(ee=n.RG8I),B===n.SHORT&&(ee=n.RG16I),B===n.INT&&(ee=n.RG32I)),S===n.RGB_INTEGER&&(B===n.UNSIGNED_BYTE&&(ee=n.RGB8UI),B===n.UNSIGNED_SHORT&&(ee=n.RGB16UI),B===n.UNSIGNED_INT&&(ee=n.RGB32UI),B===n.BYTE&&(ee=n.RGB8I),B===n.SHORT&&(ee=n.RGB16I),B===n.INT&&(ee=n.RGB32I)),S===n.RGBA_INTEGER&&(B===n.UNSIGNED_BYTE&&(ee=n.RGBA8UI),B===n.UNSIGNED_SHORT&&(ee=n.RGBA16UI),B===n.UNSIGNED_INT&&(ee=n.RGBA32UI),B===n.BYTE&&(ee=n.RGBA8I),B===n.SHORT&&(ee=n.RGBA16I),B===n.INT&&(ee=n.RGBA32I)),S===n.RGB&&B===n.UNSIGNED_INT_5_9_9_9_REV&&(ee=n.RGB9_E5),S===n.RGBA){const De=oe?nu:mt.getTransfer(Z);B===n.FLOAT&&(ee=n.RGBA32F),B===n.HALF_FLOAT&&(ee=n.RGBA16F),B===n.UNSIGNED_BYTE&&(ee=De===Nt?n.SRGB8_ALPHA8:n.RGBA8),B===n.UNSIGNED_SHORT_4_4_4_4&&(ee=n.RGBA4),B===n.UNSIGNED_SHORT_5_5_5_1&&(ee=n.RGB5_A1)}return(ee===n.R16F||ee===n.R32F||ee===n.RG16F||ee===n.RG32F||ee===n.RGBA16F||ee===n.RGBA32F)&&e.get("EXT_color_buffer_float"),ee}function x(b,S){let B;return b?S===null||S===Cs||S===ko?B=n.DEPTH24_STENCIL8:S===Mi?B=n.DEPTH32F_STENCIL8:S===rl&&(B=n.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):S===null||S===Cs||S===ko?B=n.DEPTH_COMPONENT24:S===Mi?B=n.DEPTH_COMPONENT32F:S===rl&&(B=n.DEPTH_COMPONENT16),B}function M(b,S){return m(b)===!0||b.isFramebufferTexture&&b.minFilter!==An&&b.minFilter!==kn?Math.log2(Math.max(S.width,S.height))+1:b.mipmaps!==void 0&&b.mipmaps.length>0?b.mipmaps.length:b.isCompressedTexture&&Array.isArray(b.image)?S.mipmaps.length:1}function L(b){const S=b.target;S.removeEventListener("dispose",L),T(S),S.isVideoTexture&&u.delete(S)}function A(b){const S=b.target;S.removeEventListener("dispose",A),K(S)}function T(b){const S=i.get(b);if(S.__webglInit===void 0)return;const B=b.source,Z=f.get(B);if(Z){const oe=Z[S.__cacheKey];oe.usedTimes--,oe.usedTimes===0&&I(b),Object.keys(Z).length===0&&f.delete(B)}i.remove(b)}function I(b){const S=i.get(b);n.deleteTexture(S.__webglTexture);const B=b.source,Z=f.get(B);delete Z[S.__cacheKey],o.memory.textures--}function K(b){const S=i.get(b);if(b.depthTexture&&b.depthTexture.dispose(),b.isWebGLCubeRenderTarget)for(let Z=0;Z<6;Z++){if(Array.isArray(S.__webglFramebuffer[Z]))for(let oe=0;oe<S.__webglFramebuffer[Z].length;oe++)n.deleteFramebuffer(S.__webglFramebuffer[Z][oe]);else n.deleteFramebuffer(S.__webglFramebuffer[Z]);S.__webglDepthbuffer&&n.deleteRenderbuffer(S.__webglDepthbuffer[Z])}else{if(Array.isArray(S.__webglFramebuffer))for(let Z=0;Z<S.__webglFramebuffer.length;Z++)n.deleteFramebuffer(S.__webglFramebuffer[Z]);else n.deleteFramebuffer(S.__webglFramebuffer);if(S.__webglDepthbuffer&&n.deleteRenderbuffer(S.__webglDepthbuffer),S.__webglMultisampledFramebuffer&&n.deleteFramebuffer(S.__webglMultisampledFramebuffer),S.__webglColorRenderbuffer)for(let Z=0;Z<S.__webglColorRenderbuffer.length;Z++)S.__webglColorRenderbuffer[Z]&&n.deleteRenderbuffer(S.__webglColorRenderbuffer[Z]);S.__webglDepthRenderbuffer&&n.deleteRenderbuffer(S.__webglDepthRenderbuffer)}const B=b.textures;for(let Z=0,oe=B.length;Z<oe;Z++){const ee=i.get(B[Z]);ee.__webglTexture&&(n.deleteTexture(ee.__webglTexture),o.memory.textures--),i.remove(B[Z])}i.remove(b)}let y=0;function w(){y=0}function X(){const b=y;return b>=r.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+b+" texture units while this GPU supports only "+r.maxTextures),y+=1,b}function W(b){const S=[];return S.push(b.wrapS),S.push(b.wrapT),S.push(b.wrapR||0),S.push(b.magFilter),S.push(b.minFilter),S.push(b.anisotropy),S.push(b.internalFormat),S.push(b.format),S.push(b.type),S.push(b.generateMipmaps),S.push(b.premultiplyAlpha),S.push(b.flipY),S.push(b.unpackAlignment),S.push(b.colorSpace),S.join()}function $(b,S){const B=i.get(b);if(b.isVideoTexture&&Ue(b),b.isRenderTargetTexture===!1&&b.version>0&&B.__version!==b.version){const Z=b.image;if(Z===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(Z.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{it(B,b,S);return}}t.bindTexture(n.TEXTURE_2D,B.__webglTexture,n.TEXTURE0+S)}function se(b,S){const B=i.get(b);if(b.version>0&&B.__version!==b.version){it(B,b,S);return}t.bindTexture(n.TEXTURE_2D_ARRAY,B.__webglTexture,n.TEXTURE0+S)}function j(b,S){const B=i.get(b);if(b.version>0&&B.__version!==b.version){it(B,b,S);return}t.bindTexture(n.TEXTURE_3D,B.__webglTexture,n.TEXTURE0+S)}function Q(b,S){const B=i.get(b);if(b.version>0&&B.__version!==b.version){Y(B,b,S);return}t.bindTexture(n.TEXTURE_CUBE_MAP,B.__webglTexture,n.TEXTURE0+S)}const U={[Uo]:n.REPEAT,[kr]:n.CLAMP_TO_EDGE,[tu]:n.MIRRORED_REPEAT},ie={[An]:n.NEAREST,[xv]:n.NEAREST_MIPMAP_NEAREST,[Aa]:n.NEAREST_MIPMAP_LINEAR,[kn]:n.LINEAR,[Ec]:n.LINEAR_MIPMAP_NEAREST,[Oi]:n.LINEAR_MIPMAP_LINEAR},re={[TE]:n.NEVER,[LE]:n.ALWAYS,[bE]:n.LESS,[Pv]:n.LEQUAL,[AE]:n.EQUAL,[PE]:n.GEQUAL,[RE]:n.GREATER,[CE]:n.NOTEQUAL};function fe(b,S){if(S.type===Mi&&e.has("OES_texture_float_linear")===!1&&(S.magFilter===kn||S.magFilter===Ec||S.magFilter===Aa||S.magFilter===Oi||S.minFilter===kn||S.minFilter===Ec||S.minFilter===Aa||S.minFilter===Oi)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),n.texParameteri(b,n.TEXTURE_WRAP_S,U[S.wrapS]),n.texParameteri(b,n.TEXTURE_WRAP_T,U[S.wrapT]),(b===n.TEXTURE_3D||b===n.TEXTURE_2D_ARRAY)&&n.texParameteri(b,n.TEXTURE_WRAP_R,U[S.wrapR]),n.texParameteri(b,n.TEXTURE_MAG_FILTER,ie[S.magFilter]),n.texParameteri(b,n.TEXTURE_MIN_FILTER,ie[S.minFilter]),S.compareFunction&&(n.texParameteri(b,n.TEXTURE_COMPARE_MODE,n.COMPARE_REF_TO_TEXTURE),n.texParameteri(b,n.TEXTURE_COMPARE_FUNC,re[S.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(S.magFilter===An||S.minFilter!==Aa&&S.minFilter!==Oi||S.type===Mi&&e.has("OES_texture_float_linear")===!1)return;if(S.anisotropy>1||i.get(S).__currentAnisotropy){const B=e.get("EXT_texture_filter_anisotropic");n.texParameterf(b,B.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(S.anisotropy,r.getMaxAnisotropy())),i.get(S).__currentAnisotropy=S.anisotropy}}}function Oe(b,S){let B=!1;b.__webglInit===void 0&&(b.__webglInit=!0,S.addEventListener("dispose",L));const Z=S.source;let oe=f.get(Z);oe===void 0&&(oe={},f.set(Z,oe));const ee=W(S);if(ee!==b.__cacheKey){oe[ee]===void 0&&(oe[ee]={texture:n.createTexture(),usedTimes:0},o.memory.textures++,B=!0),oe[ee].usedTimes++;const De=oe[b.__cacheKey];De!==void 0&&(oe[b.__cacheKey].usedTimes--,De.usedTimes===0&&I(S)),b.__cacheKey=ee,b.__webglTexture=oe[ee].texture}return B}function it(b,S,B){let Z=n.TEXTURE_2D;(S.isDataArrayTexture||S.isCompressedArrayTexture)&&(Z=n.TEXTURE_2D_ARRAY),S.isData3DTexture&&(Z=n.TEXTURE_3D);const oe=Oe(b,S),ee=S.source;t.bindTexture(Z,b.__webglTexture,n.TEXTURE0+B);const De=i.get(ee);if(ee.version!==De.__version||oe===!0){t.activeTexture(n.TEXTURE0+B);const pe=mt.getPrimaries(mt.workingColorSpace),we=S.colorSpace===Dr?null:mt.getPrimaries(S.colorSpace),ct=S.colorSpace===Dr||pe===we?n.NONE:n.BROWSER_DEFAULT_WEBGL;n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,S.flipY),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),n.pixelStorei(n.UNPACK_ALIGNMENT,S.unpackAlignment),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,ct);let ce=v(S.image,!1,r.maxTextureSize);ce=St(S,ce);const Ae=s.convert(S.format,S.colorSpace),Ye=s.convert(S.type);let We=_(S.internalFormat,Ae,Ye,S.colorSpace,S.isVideoTexture);fe(Z,S);let be;const rt=S.mipmaps,je=S.isVideoTexture!==!0,_t=De.__version===void 0||oe===!0,k=ee.dataReady,xe=M(S,ce);if(S.isDepthTexture)We=x(S.format===Oo,S.type),_t&&(je?t.texStorage2D(n.TEXTURE_2D,1,We,ce.width,ce.height):t.texImage2D(n.TEXTURE_2D,0,We,ce.width,ce.height,0,Ae,Ye,null));else if(S.isDataTexture)if(rt.length>0){je&&_t&&t.texStorage2D(n.TEXTURE_2D,xe,We,rt[0].width,rt[0].height);for(let G=0,te=rt.length;G<te;G++)be=rt[G],je?k&&t.texSubImage2D(n.TEXTURE_2D,G,0,0,be.width,be.height,Ae,Ye,be.data):t.texImage2D(n.TEXTURE_2D,G,We,be.width,be.height,0,Ae,Ye,be.data);S.generateMipmaps=!1}else je?(_t&&t.texStorage2D(n.TEXTURE_2D,xe,We,ce.width,ce.height),k&&t.texSubImage2D(n.TEXTURE_2D,0,0,0,ce.width,ce.height,Ae,Ye,ce.data)):t.texImage2D(n.TEXTURE_2D,0,We,ce.width,ce.height,0,Ae,Ye,ce.data);else if(S.isCompressedTexture)if(S.isCompressedArrayTexture){je&&_t&&t.texStorage3D(n.TEXTURE_2D_ARRAY,xe,We,rt[0].width,rt[0].height,ce.depth);for(let G=0,te=rt.length;G<te;G++)if(be=rt[G],S.format!==ai)if(Ae!==null)if(je){if(k)if(S.layerUpdates.size>0){const ye=m0(be.width,be.height,S.format,S.type);for(const ue of S.layerUpdates){const Je=be.data.subarray(ue*ye/be.data.BYTES_PER_ELEMENT,(ue+1)*ye/be.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,G,0,0,ue,be.width,be.height,1,Ae,Je,0,0)}S.clearLayerUpdates()}else t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,G,0,0,0,be.width,be.height,ce.depth,Ae,be.data,0,0)}else t.compressedTexImage3D(n.TEXTURE_2D_ARRAY,G,We,be.width,be.height,ce.depth,0,be.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else je?k&&t.texSubImage3D(n.TEXTURE_2D_ARRAY,G,0,0,0,be.width,be.height,ce.depth,Ae,Ye,be.data):t.texImage3D(n.TEXTURE_2D_ARRAY,G,We,be.width,be.height,ce.depth,0,Ae,Ye,be.data)}else{je&&_t&&t.texStorage2D(n.TEXTURE_2D,xe,We,rt[0].width,rt[0].height);for(let G=0,te=rt.length;G<te;G++)be=rt[G],S.format!==ai?Ae!==null?je?k&&t.compressedTexSubImage2D(n.TEXTURE_2D,G,0,0,be.width,be.height,Ae,be.data):t.compressedTexImage2D(n.TEXTURE_2D,G,We,be.width,be.height,0,be.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):je?k&&t.texSubImage2D(n.TEXTURE_2D,G,0,0,be.width,be.height,Ae,Ye,be.data):t.texImage2D(n.TEXTURE_2D,G,We,be.width,be.height,0,Ae,Ye,be.data)}else if(S.isDataArrayTexture)if(je){if(_t&&t.texStorage3D(n.TEXTURE_2D_ARRAY,xe,We,ce.width,ce.height,ce.depth),k)if(S.layerUpdates.size>0){const G=m0(ce.width,ce.height,S.format,S.type);for(const te of S.layerUpdates){const ye=ce.data.subarray(te*G/ce.data.BYTES_PER_ELEMENT,(te+1)*G/ce.data.BYTES_PER_ELEMENT);t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,te,ce.width,ce.height,1,Ae,Ye,ye)}S.clearLayerUpdates()}else t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,0,ce.width,ce.height,ce.depth,Ae,Ye,ce.data)}else t.texImage3D(n.TEXTURE_2D_ARRAY,0,We,ce.width,ce.height,ce.depth,0,Ae,Ye,ce.data);else if(S.isData3DTexture)je?(_t&&t.texStorage3D(n.TEXTURE_3D,xe,We,ce.width,ce.height,ce.depth),k&&t.texSubImage3D(n.TEXTURE_3D,0,0,0,0,ce.width,ce.height,ce.depth,Ae,Ye,ce.data)):t.texImage3D(n.TEXTURE_3D,0,We,ce.width,ce.height,ce.depth,0,Ae,Ye,ce.data);else if(S.isFramebufferTexture){if(_t)if(je)t.texStorage2D(n.TEXTURE_2D,xe,We,ce.width,ce.height);else{let G=ce.width,te=ce.height;for(let ye=0;ye<xe;ye++)t.texImage2D(n.TEXTURE_2D,ye,We,G,te,0,Ae,Ye,null),G>>=1,te>>=1}}else if(rt.length>0){if(je&&_t){const G=ke(rt[0]);t.texStorage2D(n.TEXTURE_2D,xe,We,G.width,G.height)}for(let G=0,te=rt.length;G<te;G++)be=rt[G],je?k&&t.texSubImage2D(n.TEXTURE_2D,G,0,0,Ae,Ye,be):t.texImage2D(n.TEXTURE_2D,G,We,Ae,Ye,be);S.generateMipmaps=!1}else if(je){if(_t){const G=ke(ce);t.texStorage2D(n.TEXTURE_2D,xe,We,G.width,G.height)}k&&t.texSubImage2D(n.TEXTURE_2D,0,0,0,Ae,Ye,ce)}else t.texImage2D(n.TEXTURE_2D,0,We,Ae,Ye,ce);m(S)&&h(Z),De.__version=ee.version,S.onUpdate&&S.onUpdate(S)}b.__version=S.version}function Y(b,S,B){if(S.image.length!==6)return;const Z=Oe(b,S),oe=S.source;t.bindTexture(n.TEXTURE_CUBE_MAP,b.__webglTexture,n.TEXTURE0+B);const ee=i.get(oe);if(oe.version!==ee.__version||Z===!0){t.activeTexture(n.TEXTURE0+B);const De=mt.getPrimaries(mt.workingColorSpace),pe=S.colorSpace===Dr?null:mt.getPrimaries(S.colorSpace),we=S.colorSpace===Dr||De===pe?n.NONE:n.BROWSER_DEFAULT_WEBGL;n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,S.flipY),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),n.pixelStorei(n.UNPACK_ALIGNMENT,S.unpackAlignment),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,we);const ct=S.isCompressedTexture||S.image[0].isCompressedTexture,ce=S.image[0]&&S.image[0].isDataTexture,Ae=[];for(let te=0;te<6;te++)!ct&&!ce?Ae[te]=v(S.image[te],!0,r.maxCubemapSize):Ae[te]=ce?S.image[te].image:S.image[te],Ae[te]=St(S,Ae[te]);const Ye=Ae[0],We=s.convert(S.format,S.colorSpace),be=s.convert(S.type),rt=_(S.internalFormat,We,be,S.colorSpace),je=S.isVideoTexture!==!0,_t=ee.__version===void 0||Z===!0,k=oe.dataReady;let xe=M(S,Ye);fe(n.TEXTURE_CUBE_MAP,S);let G;if(ct){je&&_t&&t.texStorage2D(n.TEXTURE_CUBE_MAP,xe,rt,Ye.width,Ye.height);for(let te=0;te<6;te++){G=Ae[te].mipmaps;for(let ye=0;ye<G.length;ye++){const ue=G[ye];S.format!==ai?We!==null?je?k&&t.compressedTexSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+te,ye,0,0,ue.width,ue.height,We,ue.data):t.compressedTexImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+te,ye,rt,ue.width,ue.height,0,ue.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):je?k&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+te,ye,0,0,ue.width,ue.height,We,be,ue.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+te,ye,rt,ue.width,ue.height,0,We,be,ue.data)}}}else{if(G=S.mipmaps,je&&_t){G.length>0&&xe++;const te=ke(Ae[0]);t.texStorage2D(n.TEXTURE_CUBE_MAP,xe,rt,te.width,te.height)}for(let te=0;te<6;te++)if(ce){je?k&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+te,0,0,0,Ae[te].width,Ae[te].height,We,be,Ae[te].data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+te,0,rt,Ae[te].width,Ae[te].height,0,We,be,Ae[te].data);for(let ye=0;ye<G.length;ye++){const Je=G[ye].image[te].image;je?k&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+te,ye+1,0,0,Je.width,Je.height,We,be,Je.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+te,ye+1,rt,Je.width,Je.height,0,We,be,Je.data)}}else{je?k&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+te,0,0,0,We,be,Ae[te]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+te,0,rt,We,be,Ae[te]);for(let ye=0;ye<G.length;ye++){const ue=G[ye];je?k&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+te,ye+1,0,0,We,be,ue.image[te]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+te,ye+1,rt,We,be,ue.image[te])}}}m(S)&&h(n.TEXTURE_CUBE_MAP),ee.__version=oe.version,S.onUpdate&&S.onUpdate(S)}b.__version=S.version}function ae(b,S,B,Z,oe,ee){const De=s.convert(B.format,B.colorSpace),pe=s.convert(B.type),we=_(B.internalFormat,De,pe,B.colorSpace);if(!i.get(S).__hasExternalTextures){const ce=Math.max(1,S.width>>ee),Ae=Math.max(1,S.height>>ee);oe===n.TEXTURE_3D||oe===n.TEXTURE_2D_ARRAY?t.texImage3D(oe,ee,we,ce,Ae,S.depth,0,De,pe,null):t.texImage2D(oe,ee,we,ce,Ae,0,De,pe,null)}t.bindFramebuffer(n.FRAMEBUFFER,b),dt(S)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,Z,oe,i.get(B).__webglTexture,0,Ge(S)):(oe===n.TEXTURE_2D||oe>=n.TEXTURE_CUBE_MAP_POSITIVE_X&&oe<=n.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&n.framebufferTexture2D(n.FRAMEBUFFER,Z,oe,i.get(B).__webglTexture,ee),t.bindFramebuffer(n.FRAMEBUFFER,null)}function Me(b,S,B){if(n.bindRenderbuffer(n.RENDERBUFFER,b),S.depthBuffer){const Z=S.depthTexture,oe=Z&&Z.isDepthTexture?Z.type:null,ee=x(S.stencilBuffer,oe),De=S.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,pe=Ge(S);dt(S)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,pe,ee,S.width,S.height):B?n.renderbufferStorageMultisample(n.RENDERBUFFER,pe,ee,S.width,S.height):n.renderbufferStorage(n.RENDERBUFFER,ee,S.width,S.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,De,n.RENDERBUFFER,b)}else{const Z=S.textures;for(let oe=0;oe<Z.length;oe++){const ee=Z[oe],De=s.convert(ee.format,ee.colorSpace),pe=s.convert(ee.type),we=_(ee.internalFormat,De,pe,ee.colorSpace),ct=Ge(S);B&&dt(S)===!1?n.renderbufferStorageMultisample(n.RENDERBUFFER,ct,we,S.width,S.height):dt(S)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,ct,we,S.width,S.height):n.renderbufferStorage(n.RENDERBUFFER,we,S.width,S.height)}}n.bindRenderbuffer(n.RENDERBUFFER,null)}function ve(b,S){if(S&&S.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(n.FRAMEBUFFER,b),!(S.depthTexture&&S.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");(!i.get(S.depthTexture).__webglTexture||S.depthTexture.image.width!==S.width||S.depthTexture.image.height!==S.height)&&(S.depthTexture.image.width=S.width,S.depthTexture.image.height=S.height,S.depthTexture.needsUpdate=!0),$(S.depthTexture,0);const Z=i.get(S.depthTexture).__webglTexture,oe=Ge(S);if(S.depthTexture.format===Mo)dt(S)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,n.DEPTH_ATTACHMENT,n.TEXTURE_2D,Z,0,oe):n.framebufferTexture2D(n.FRAMEBUFFER,n.DEPTH_ATTACHMENT,n.TEXTURE_2D,Z,0);else if(S.depthTexture.format===Oo)dt(S)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,n.DEPTH_STENCIL_ATTACHMENT,n.TEXTURE_2D,Z,0,oe):n.framebufferTexture2D(n.FRAMEBUFFER,n.DEPTH_STENCIL_ATTACHMENT,n.TEXTURE_2D,Z,0);else throw new Error("Unknown depthTexture format")}function qe(b){const S=i.get(b),B=b.isWebGLCubeRenderTarget===!0;if(S.__boundDepthTexture!==b.depthTexture){const Z=b.depthTexture;if(S.__depthDisposeCallback&&S.__depthDisposeCallback(),Z){const oe=()=>{delete S.__boundDepthTexture,delete S.__depthDisposeCallback,Z.removeEventListener("dispose",oe)};Z.addEventListener("dispose",oe),S.__depthDisposeCallback=oe}S.__boundDepthTexture=Z}if(b.depthTexture&&!S.__autoAllocateDepthBuffer){if(B)throw new Error("target.depthTexture not supported in Cube render targets");ve(S.__webglFramebuffer,b)}else if(B){S.__webglDepthbuffer=[];for(let Z=0;Z<6;Z++)if(t.bindFramebuffer(n.FRAMEBUFFER,S.__webglFramebuffer[Z]),S.__webglDepthbuffer[Z]===void 0)S.__webglDepthbuffer[Z]=n.createRenderbuffer(),Me(S.__webglDepthbuffer[Z],b,!1);else{const oe=b.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,ee=S.__webglDepthbuffer[Z];n.bindRenderbuffer(n.RENDERBUFFER,ee),n.framebufferRenderbuffer(n.FRAMEBUFFER,oe,n.RENDERBUFFER,ee)}}else if(t.bindFramebuffer(n.FRAMEBUFFER,S.__webglFramebuffer),S.__webglDepthbuffer===void 0)S.__webglDepthbuffer=n.createRenderbuffer(),Me(S.__webglDepthbuffer,b,!1);else{const Z=b.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,oe=S.__webglDepthbuffer;n.bindRenderbuffer(n.RENDERBUFFER,oe),n.framebufferRenderbuffer(n.FRAMEBUFFER,Z,n.RENDERBUFFER,oe)}t.bindFramebuffer(n.FRAMEBUFFER,null)}function Fe(b,S,B){const Z=i.get(b);S!==void 0&&ae(Z.__webglFramebuffer,b,b.texture,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,0),B!==void 0&&qe(b)}function lt(b){const S=b.texture,B=i.get(b),Z=i.get(S);b.addEventListener("dispose",A);const oe=b.textures,ee=b.isWebGLCubeRenderTarget===!0,De=oe.length>1;if(De||(Z.__webglTexture===void 0&&(Z.__webglTexture=n.createTexture()),Z.__version=S.version,o.memory.textures++),ee){B.__webglFramebuffer=[];for(let pe=0;pe<6;pe++)if(S.mipmaps&&S.mipmaps.length>0){B.__webglFramebuffer[pe]=[];for(let we=0;we<S.mipmaps.length;we++)B.__webglFramebuffer[pe][we]=n.createFramebuffer()}else B.__webglFramebuffer[pe]=n.createFramebuffer()}else{if(S.mipmaps&&S.mipmaps.length>0){B.__webglFramebuffer=[];for(let pe=0;pe<S.mipmaps.length;pe++)B.__webglFramebuffer[pe]=n.createFramebuffer()}else B.__webglFramebuffer=n.createFramebuffer();if(De)for(let pe=0,we=oe.length;pe<we;pe++){const ct=i.get(oe[pe]);ct.__webglTexture===void 0&&(ct.__webglTexture=n.createTexture(),o.memory.textures++)}if(b.samples>0&&dt(b)===!1){B.__webglMultisampledFramebuffer=n.createFramebuffer(),B.__webglColorRenderbuffer=[],t.bindFramebuffer(n.FRAMEBUFFER,B.__webglMultisampledFramebuffer);for(let pe=0;pe<oe.length;pe++){const we=oe[pe];B.__webglColorRenderbuffer[pe]=n.createRenderbuffer(),n.bindRenderbuffer(n.RENDERBUFFER,B.__webglColorRenderbuffer[pe]);const ct=s.convert(we.format,we.colorSpace),ce=s.convert(we.type),Ae=_(we.internalFormat,ct,ce,we.colorSpace,b.isXRRenderTarget===!0),Ye=Ge(b);n.renderbufferStorageMultisample(n.RENDERBUFFER,Ye,Ae,b.width,b.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+pe,n.RENDERBUFFER,B.__webglColorRenderbuffer[pe])}n.bindRenderbuffer(n.RENDERBUFFER,null),b.depthBuffer&&(B.__webglDepthRenderbuffer=n.createRenderbuffer(),Me(B.__webglDepthRenderbuffer,b,!0)),t.bindFramebuffer(n.FRAMEBUFFER,null)}}if(ee){t.bindTexture(n.TEXTURE_CUBE_MAP,Z.__webglTexture),fe(n.TEXTURE_CUBE_MAP,S);for(let pe=0;pe<6;pe++)if(S.mipmaps&&S.mipmaps.length>0)for(let we=0;we<S.mipmaps.length;we++)ae(B.__webglFramebuffer[pe][we],b,S,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+pe,we);else ae(B.__webglFramebuffer[pe],b,S,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+pe,0);m(S)&&h(n.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(De){for(let pe=0,we=oe.length;pe<we;pe++){const ct=oe[pe],ce=i.get(ct);t.bindTexture(n.TEXTURE_2D,ce.__webglTexture),fe(n.TEXTURE_2D,ct),ae(B.__webglFramebuffer,b,ct,n.COLOR_ATTACHMENT0+pe,n.TEXTURE_2D,0),m(ct)&&h(n.TEXTURE_2D)}t.unbindTexture()}else{let pe=n.TEXTURE_2D;if((b.isWebGL3DRenderTarget||b.isWebGLArrayRenderTarget)&&(pe=b.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(pe,Z.__webglTexture),fe(pe,S),S.mipmaps&&S.mipmaps.length>0)for(let we=0;we<S.mipmaps.length;we++)ae(B.__webglFramebuffer[we],b,S,n.COLOR_ATTACHMENT0,pe,we);else ae(B.__webglFramebuffer,b,S,n.COLOR_ATTACHMENT0,pe,0);m(S)&&h(pe),t.unbindTexture()}b.depthBuffer&&qe(b)}function ge(b){const S=b.textures;for(let B=0,Z=S.length;B<Z;B++){const oe=S[B];if(m(oe)){const ee=b.isWebGLCubeRenderTarget?n.TEXTURE_CUBE_MAP:n.TEXTURE_2D,De=i.get(oe).__webglTexture;t.bindTexture(ee,De),h(ee),t.unbindTexture()}}}const Qe=[],D=[];function mn(b){if(b.samples>0){if(dt(b)===!1){const S=b.textures,B=b.width,Z=b.height;let oe=n.COLOR_BUFFER_BIT;const ee=b.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,De=i.get(b),pe=S.length>1;if(pe)for(let we=0;we<S.length;we++)t.bindFramebuffer(n.FRAMEBUFFER,De.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+we,n.RENDERBUFFER,null),t.bindFramebuffer(n.FRAMEBUFFER,De.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+we,n.TEXTURE_2D,null,0);t.bindFramebuffer(n.READ_FRAMEBUFFER,De.__webglMultisampledFramebuffer),t.bindFramebuffer(n.DRAW_FRAMEBUFFER,De.__webglFramebuffer);for(let we=0;we<S.length;we++){if(b.resolveDepthBuffer&&(b.depthBuffer&&(oe|=n.DEPTH_BUFFER_BIT),b.stencilBuffer&&b.resolveStencilBuffer&&(oe|=n.STENCIL_BUFFER_BIT)),pe){n.framebufferRenderbuffer(n.READ_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.RENDERBUFFER,De.__webglColorRenderbuffer[we]);const ct=i.get(S[we]).__webglTexture;n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,ct,0)}n.blitFramebuffer(0,0,B,Z,0,0,B,Z,oe,n.NEAREST),l===!0&&(Qe.length=0,D.length=0,Qe.push(n.COLOR_ATTACHMENT0+we),b.depthBuffer&&b.resolveDepthBuffer===!1&&(Qe.push(ee),D.push(ee),n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,D)),n.invalidateFramebuffer(n.READ_FRAMEBUFFER,Qe))}if(t.bindFramebuffer(n.READ_FRAMEBUFFER,null),t.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),pe)for(let we=0;we<S.length;we++){t.bindFramebuffer(n.FRAMEBUFFER,De.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+we,n.RENDERBUFFER,De.__webglColorRenderbuffer[we]);const ct=i.get(S[we]).__webglTexture;t.bindFramebuffer(n.FRAMEBUFFER,De.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+we,n.TEXTURE_2D,ct,0)}t.bindFramebuffer(n.DRAW_FRAMEBUFFER,De.__webglMultisampledFramebuffer)}else if(b.depthBuffer&&b.resolveDepthBuffer===!1&&l){const S=b.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,[S])}}}function Ge(b){return Math.min(r.maxSamples,b.samples)}function dt(b){const S=i.get(b);return b.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&S.__useRenderToTexture!==!1}function Ue(b){const S=o.render.frame;u.get(b)!==S&&(u.set(b,S),b.update())}function St(b,S){const B=b.colorSpace,Z=b.format,oe=b.type;return b.isCompressedTexture===!0||b.isVideoTexture===!0||B!==an&&B!==Dr&&(mt.getTransfer(B)===Nt?(Z!==ai||oe!==gr)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",B)),S}function ke(b){return typeof HTMLImageElement<"u"&&b instanceof HTMLImageElement?(c.width=b.naturalWidth||b.width,c.height=b.naturalHeight||b.height):typeof VideoFrame<"u"&&b instanceof VideoFrame?(c.width=b.displayWidth,c.height=b.displayHeight):(c.width=b.width,c.height=b.height),c}this.allocateTextureUnit=X,this.resetTextureUnits=w,this.setTexture2D=$,this.setTexture2DArray=se,this.setTexture3D=j,this.setTextureCube=Q,this.rebindTextures=Fe,this.setupRenderTarget=lt,this.updateRenderTargetMipmap=ge,this.updateMultisampleRenderTarget=mn,this.setupDepthRenderbuffer=qe,this.setupFrameBufferTexture=ae,this.useMultisampledRTT=dt}function ZA(n,e){function t(i,r=Dr){let s;const o=mt.getTransfer(r);if(i===gr)return n.UNSIGNED_BYTE;if(i===Lp)return n.UNSIGNED_SHORT_4_4_4_4;if(i===Np)return n.UNSIGNED_SHORT_5_5_5_1;if(i===Sv)return n.UNSIGNED_INT_5_9_9_9_REV;if(i===vv)return n.BYTE;if(i===yv)return n.SHORT;if(i===rl)return n.UNSIGNED_SHORT;if(i===Pp)return n.INT;if(i===Cs)return n.UNSIGNED_INT;if(i===Mi)return n.FLOAT;if(i===hl)return n.HALF_FLOAT;if(i===Mv)return n.ALPHA;if(i===Ev)return n.RGB;if(i===ai)return n.RGBA;if(i===wv)return n.LUMINANCE;if(i===Tv)return n.LUMINANCE_ALPHA;if(i===Mo)return n.DEPTH_COMPONENT;if(i===Oo)return n.DEPTH_STENCIL;if(i===Dp)return n.RED;if(i===Ip)return n.RED_INTEGER;if(i===bv)return n.RG;if(i===Up)return n.RG_INTEGER;if(i===kp)return n.RGBA_INTEGER;if(i===wc||i===Tc||i===bc||i===Ac)if(o===Nt)if(s=e.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(i===wc)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===Tc)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===bc)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===Ac)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=e.get("WEBGL_compressed_texture_s3tc"),s!==null){if(i===wc)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===Tc)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===bc)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===Ac)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===Qf||i===eh||i===th||i===nh)if(s=e.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(i===Qf)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===eh)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===th)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===nh)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===ih||i===rh||i===sh)if(s=e.get("WEBGL_compressed_texture_etc"),s!==null){if(i===ih||i===rh)return o===Nt?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(i===sh)return o===Nt?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(i===oh||i===ah||i===lh||i===ch||i===uh||i===dh||i===fh||i===hh||i===ph||i===mh||i===gh||i===_h||i===xh||i===vh)if(s=e.get("WEBGL_compressed_texture_astc"),s!==null){if(i===oh)return o===Nt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===ah)return o===Nt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===lh)return o===Nt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===ch)return o===Nt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===uh)return o===Nt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===dh)return o===Nt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===fh)return o===Nt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===hh)return o===Nt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===ph)return o===Nt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===mh)return o===Nt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===gh)return o===Nt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===_h)return o===Nt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===xh)return o===Nt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===vh)return o===Nt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===Rc||i===yh||i===Sh)if(s=e.get("EXT_texture_compression_bptc"),s!==null){if(i===Rc)return o===Nt?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===yh)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===Sh)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===Av||i===Mh||i===Eh||i===wh)if(s=e.get("EXT_texture_compression_rgtc"),s!==null){if(i===Rc)return s.COMPRESSED_RED_RGTC1_EXT;if(i===Mh)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===Eh)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===wh)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===ko?n.UNSIGNED_INT_24_8:n[i]!==void 0?n[i]:null}return{convert:t}}class JA extends bn{constructor(e=[]){super(),this.isArrayCamera=!0,this.cameras=e}}class Ss extends Bt{constructor(){super(),this.isGroup=!0,this.type="Group"}}const QA={type:"move"};class Dd{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Ss,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Ss,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new N,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new N),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Ss,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new N,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new N),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const i of e.hand.values())this._getHandJoint(t,i)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,i){let r=null,s=null,o=null;const a=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){o=!0;for(const v of e.hand.values()){const m=t.getJointPose(v,i),h=this._getHandJoint(c,v);m!==null&&(h.matrix.fromArray(m.transform.matrix),h.matrix.decompose(h.position,h.rotation,h.scale),h.matrixWorldNeedsUpdate=!0,h.jointRadius=m.radius),h.visible=m!==null}const u=c.joints["index-finger-tip"],d=c.joints["thumb-tip"],f=u.position.distanceTo(d.position),p=.02,g=.005;c.inputState.pinching&&f>p+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&f<=p-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(s=t.getPose(e.gripSpace,i),s!==null&&(l.matrix.fromArray(s.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,s.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(s.linearVelocity)):l.hasLinearVelocity=!1,s.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(s.angularVelocity)):l.hasAngularVelocity=!1));a!==null&&(r=t.getPose(e.targetRaySpace,i),r===null&&s!==null&&(r=s),r!==null&&(a.matrix.fromArray(r.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,r.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(r.linearVelocity)):a.hasLinearVelocity=!1,r.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(r.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(QA)))}return a!==null&&(a.visible=r!==null),l!==null&&(l.visible=s!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const i=new Ss;i.matrixAutoUpdate=!1,i.visible=!1,e.joints[t.jointName]=i,e.add(i)}return e.joints[t.jointName]}}const eR=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,tR=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class nR{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t,i){if(this.texture===null){const r=new on,s=e.properties.get(r);s.__webglTexture=t.texture,(t.depthNear!=i.depthNear||t.depthFar!=i.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=r}}getMesh(e){if(this.texture!==null&&this.mesh===null){const t=e.cameras[0].viewport,i=new qr({vertexShader:eR,fragmentShader:tR,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Yn(new Ru(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class iR extends Ds{constructor(e,t){super();const i=this;let r=null,s=1,o=null,a="local-floor",l=1,c=null,u=null,d=null,f=null,p=null,g=null;const v=new nR,m=t.getContextAttributes();let h=null,_=null;const x=[],M=[],L=new He;let A=null;const T=new bn;T.layers.enable(1),T.viewport=new yt;const I=new bn;I.layers.enable(2),I.viewport=new yt;const K=[T,I],y=new JA;y.layers.enable(1),y.layers.enable(2);let w=null,X=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Y){let ae=x[Y];return ae===void 0&&(ae=new Dd,x[Y]=ae),ae.getTargetRaySpace()},this.getControllerGrip=function(Y){let ae=x[Y];return ae===void 0&&(ae=new Dd,x[Y]=ae),ae.getGripSpace()},this.getHand=function(Y){let ae=x[Y];return ae===void 0&&(ae=new Dd,x[Y]=ae),ae.getHandSpace()};function W(Y){const ae=M.indexOf(Y.inputSource);if(ae===-1)return;const Me=x[ae];Me!==void 0&&(Me.update(Y.inputSource,Y.frame,c||o),Me.dispatchEvent({type:Y.type,data:Y.inputSource}))}function $(){r.removeEventListener("select",W),r.removeEventListener("selectstart",W),r.removeEventListener("selectend",W),r.removeEventListener("squeeze",W),r.removeEventListener("squeezestart",W),r.removeEventListener("squeezeend",W),r.removeEventListener("end",$),r.removeEventListener("inputsourceschange",se);for(let Y=0;Y<x.length;Y++){const ae=M[Y];ae!==null&&(M[Y]=null,x[Y].disconnect(ae))}w=null,X=null,v.reset(),e.setRenderTarget(h),p=null,f=null,d=null,r=null,_=null,it.stop(),i.isPresenting=!1,e.setPixelRatio(A),e.setSize(L.width,L.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Y){s=Y,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Y){a=Y,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function(Y){c=Y},this.getBaseLayer=function(){return f!==null?f:p},this.getBinding=function(){return d},this.getFrame=function(){return g},this.getSession=function(){return r},this.setSession=async function(Y){if(r=Y,r!==null){if(h=e.getRenderTarget(),r.addEventListener("select",W),r.addEventListener("selectstart",W),r.addEventListener("selectend",W),r.addEventListener("squeeze",W),r.addEventListener("squeezestart",W),r.addEventListener("squeezeend",W),r.addEventListener("end",$),r.addEventListener("inputsourceschange",se),m.xrCompatible!==!0&&await t.makeXRCompatible(),A=e.getPixelRatio(),e.getSize(L),r.renderState.layers===void 0){const ae={antialias:m.antialias,alpha:!0,depth:m.depth,stencil:m.stencil,framebufferScaleFactor:s};p=new XRWebGLLayer(r,t,ae),r.updateRenderState({baseLayer:p}),e.setPixelRatio(1),e.setSize(p.framebufferWidth,p.framebufferHeight,!1),_=new Ps(p.framebufferWidth,p.framebufferHeight,{format:ai,type:gr,colorSpace:e.outputColorSpace,stencilBuffer:m.stencil})}else{let ae=null,Me=null,ve=null;m.depth&&(ve=m.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,ae=m.stencil?Oo:Mo,Me=m.stencil?ko:Cs);const qe={colorFormat:t.RGBA8,depthFormat:ve,scaleFactor:s};d=new XRWebGLBinding(r,t),f=d.createProjectionLayer(qe),r.updateRenderState({layers:[f]}),e.setPixelRatio(1),e.setSize(f.textureWidth,f.textureHeight,!1),_=new Ps(f.textureWidth,f.textureHeight,{format:ai,type:gr,depthTexture:new Vv(f.textureWidth,f.textureHeight,Me,void 0,void 0,void 0,void 0,void 0,void 0,ae),stencilBuffer:m.stencil,colorSpace:e.outputColorSpace,samples:m.antialias?4:0,resolveDepthBuffer:f.ignoreDepthValues===!1})}_.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await r.requestReferenceSpace(a),it.setContext(r),it.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return v.getDepthTexture()};function se(Y){for(let ae=0;ae<Y.removed.length;ae++){const Me=Y.removed[ae],ve=M.indexOf(Me);ve>=0&&(M[ve]=null,x[ve].disconnect(Me))}for(let ae=0;ae<Y.added.length;ae++){const Me=Y.added[ae];let ve=M.indexOf(Me);if(ve===-1){for(let Fe=0;Fe<x.length;Fe++)if(Fe>=M.length){M.push(Me),ve=Fe;break}else if(M[Fe]===null){M[Fe]=Me,ve=Fe;break}if(ve===-1)break}const qe=x[ve];qe&&qe.connect(Me)}}const j=new N,Q=new N;function U(Y,ae,Me){j.setFromMatrixPosition(ae.matrixWorld),Q.setFromMatrixPosition(Me.matrixWorld);const ve=j.distanceTo(Q),qe=ae.projectionMatrix.elements,Fe=Me.projectionMatrix.elements,lt=qe[14]/(qe[10]-1),ge=qe[14]/(qe[10]+1),Qe=(qe[9]+1)/qe[5],D=(qe[9]-1)/qe[5],mn=(qe[8]-1)/qe[0],Ge=(Fe[8]+1)/Fe[0],dt=lt*mn,Ue=lt*Ge,St=ve/(-mn+Ge),ke=St*-mn;if(ae.matrixWorld.decompose(Y.position,Y.quaternion,Y.scale),Y.translateX(ke),Y.translateZ(St),Y.matrixWorld.compose(Y.position,Y.quaternion,Y.scale),Y.matrixWorldInverse.copy(Y.matrixWorld).invert(),qe[10]===-1)Y.projectionMatrix.copy(ae.projectionMatrix),Y.projectionMatrixInverse.copy(ae.projectionMatrixInverse);else{const b=lt+St,S=ge+St,B=dt-ke,Z=Ue+(ve-ke),oe=Qe*ge/S*b,ee=D*ge/S*b;Y.projectionMatrix.makePerspective(B,Z,oe,ee,b,S),Y.projectionMatrixInverse.copy(Y.projectionMatrix).invert()}}function ie(Y,ae){ae===null?Y.matrixWorld.copy(Y.matrix):Y.matrixWorld.multiplyMatrices(ae.matrixWorld,Y.matrix),Y.matrixWorldInverse.copy(Y.matrixWorld).invert()}this.updateCamera=function(Y){if(r===null)return;let ae=Y.near,Me=Y.far;v.texture!==null&&(v.depthNear>0&&(ae=v.depthNear),v.depthFar>0&&(Me=v.depthFar)),y.near=I.near=T.near=ae,y.far=I.far=T.far=Me,(w!==y.near||X!==y.far)&&(r.updateRenderState({depthNear:y.near,depthFar:y.far}),w=y.near,X=y.far);const ve=Y.parent,qe=y.cameras;ie(y,ve);for(let Fe=0;Fe<qe.length;Fe++)ie(qe[Fe],ve);qe.length===2?U(y,T,I):y.projectionMatrix.copy(T.projectionMatrix),re(Y,y,ve)};function re(Y,ae,Me){Me===null?Y.matrix.copy(ae.matrixWorld):(Y.matrix.copy(Me.matrixWorld),Y.matrix.invert(),Y.matrix.multiply(ae.matrixWorld)),Y.matrix.decompose(Y.position,Y.quaternion,Y.scale),Y.updateMatrixWorld(!0),Y.projectionMatrix.copy(ae.projectionMatrix),Y.projectionMatrixInverse.copy(ae.projectionMatrixInverse),Y.isPerspectiveCamera&&(Y.fov=Fo*2*Math.atan(1/Y.projectionMatrix.elements[5]),Y.zoom=1)}this.getCamera=function(){return y},this.getFoveation=function(){if(!(f===null&&p===null))return l},this.setFoveation=function(Y){l=Y,f!==null&&(f.fixedFoveation=Y),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=Y)},this.hasDepthSensing=function(){return v.texture!==null},this.getDepthSensingMesh=function(){return v.getMesh(y)};let fe=null;function Oe(Y,ae){if(u=ae.getViewerPose(c||o),g=ae,u!==null){const Me=u.views;p!==null&&(e.setRenderTargetFramebuffer(_,p.framebuffer),e.setRenderTarget(_));let ve=!1;Me.length!==y.cameras.length&&(y.cameras.length=0,ve=!0);for(let Fe=0;Fe<Me.length;Fe++){const lt=Me[Fe];let ge=null;if(p!==null)ge=p.getViewport(lt);else{const D=d.getViewSubImage(f,lt);ge=D.viewport,Fe===0&&(e.setRenderTargetTextures(_,D.colorTexture,f.ignoreDepthValues?void 0:D.depthStencilTexture),e.setRenderTarget(_))}let Qe=K[Fe];Qe===void 0&&(Qe=new bn,Qe.layers.enable(Fe),Qe.viewport=new yt,K[Fe]=Qe),Qe.matrix.fromArray(lt.transform.matrix),Qe.matrix.decompose(Qe.position,Qe.quaternion,Qe.scale),Qe.projectionMatrix.fromArray(lt.projectionMatrix),Qe.projectionMatrixInverse.copy(Qe.projectionMatrix).invert(),Qe.viewport.set(ge.x,ge.y,ge.width,ge.height),Fe===0&&(y.matrix.copy(Qe.matrix),y.matrix.decompose(y.position,y.quaternion,y.scale)),ve===!0&&y.cameras.push(Qe)}const qe=r.enabledFeatures;if(qe&&qe.includes("depth-sensing")){const Fe=d.getDepthInformation(Me[0]);Fe&&Fe.isValid&&Fe.texture&&v.init(e,Fe,r.renderState)}}for(let Me=0;Me<x.length;Me++){const ve=M[Me],qe=x[Me];ve!==null&&qe!==void 0&&qe.update(ve,ae,c||o)}fe&&fe(Y,ae),ae.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:ae}),g=null}const it=new Hv;it.setAnimationLoop(Oe),this.setAnimationLoop=function(Y){fe=Y},this.dispose=function(){}}}const ls=new Gi,rR=new Ze;function sR(n,e){function t(m,h){m.matrixAutoUpdate===!0&&m.updateMatrix(),h.value.copy(m.matrix)}function i(m,h){h.color.getRGB(m.fogColor.value,Fv(n)),h.isFog?(m.fogNear.value=h.near,m.fogFar.value=h.far):h.isFogExp2&&(m.fogDensity.value=h.density)}function r(m,h,_,x,M){h.isMeshBasicMaterial||h.isMeshLambertMaterial?s(m,h):h.isMeshToonMaterial?(s(m,h),d(m,h)):h.isMeshPhongMaterial?(s(m,h),u(m,h)):h.isMeshStandardMaterial?(s(m,h),f(m,h),h.isMeshPhysicalMaterial&&p(m,h,M)):h.isMeshMatcapMaterial?(s(m,h),g(m,h)):h.isMeshDepthMaterial?s(m,h):h.isMeshDistanceMaterial?(s(m,h),v(m,h)):h.isMeshNormalMaterial?s(m,h):h.isLineBasicMaterial?(o(m,h),h.isLineDashedMaterial&&a(m,h)):h.isPointsMaterial?l(m,h,_,x):h.isSpriteMaterial?c(m,h):h.isShadowMaterial?(m.color.value.copy(h.color),m.opacity.value=h.opacity):h.isShaderMaterial&&(h.uniformsNeedUpdate=!1)}function s(m,h){m.opacity.value=h.opacity,h.color&&m.diffuse.value.copy(h.color),h.emissive&&m.emissive.value.copy(h.emissive).multiplyScalar(h.emissiveIntensity),h.map&&(m.map.value=h.map,t(h.map,m.mapTransform)),h.alphaMap&&(m.alphaMap.value=h.alphaMap,t(h.alphaMap,m.alphaMapTransform)),h.bumpMap&&(m.bumpMap.value=h.bumpMap,t(h.bumpMap,m.bumpMapTransform),m.bumpScale.value=h.bumpScale,h.side===Hn&&(m.bumpScale.value*=-1)),h.normalMap&&(m.normalMap.value=h.normalMap,t(h.normalMap,m.normalMapTransform),m.normalScale.value.copy(h.normalScale),h.side===Hn&&m.normalScale.value.negate()),h.displacementMap&&(m.displacementMap.value=h.displacementMap,t(h.displacementMap,m.displacementMapTransform),m.displacementScale.value=h.displacementScale,m.displacementBias.value=h.displacementBias),h.emissiveMap&&(m.emissiveMap.value=h.emissiveMap,t(h.emissiveMap,m.emissiveMapTransform)),h.specularMap&&(m.specularMap.value=h.specularMap,t(h.specularMap,m.specularMapTransform)),h.alphaTest>0&&(m.alphaTest.value=h.alphaTest);const _=e.get(h),x=_.envMap,M=_.envMapRotation;x&&(m.envMap.value=x,ls.copy(M),ls.x*=-1,ls.y*=-1,ls.z*=-1,x.isCubeTexture&&x.isRenderTargetTexture===!1&&(ls.y*=-1,ls.z*=-1),m.envMapRotation.value.setFromMatrix4(rR.makeRotationFromEuler(ls)),m.flipEnvMap.value=x.isCubeTexture&&x.isRenderTargetTexture===!1?-1:1,m.reflectivity.value=h.reflectivity,m.ior.value=h.ior,m.refractionRatio.value=h.refractionRatio),h.lightMap&&(m.lightMap.value=h.lightMap,m.lightMapIntensity.value=h.lightMapIntensity,t(h.lightMap,m.lightMapTransform)),h.aoMap&&(m.aoMap.value=h.aoMap,m.aoMapIntensity.value=h.aoMapIntensity,t(h.aoMap,m.aoMapTransform))}function o(m,h){m.diffuse.value.copy(h.color),m.opacity.value=h.opacity,h.map&&(m.map.value=h.map,t(h.map,m.mapTransform))}function a(m,h){m.dashSize.value=h.dashSize,m.totalSize.value=h.dashSize+h.gapSize,m.scale.value=h.scale}function l(m,h,_,x){m.diffuse.value.copy(h.color),m.opacity.value=h.opacity,m.size.value=h.size*_,m.scale.value=x*.5,h.map&&(m.map.value=h.map,t(h.map,m.uvTransform)),h.alphaMap&&(m.alphaMap.value=h.alphaMap,t(h.alphaMap,m.alphaMapTransform)),h.alphaTest>0&&(m.alphaTest.value=h.alphaTest)}function c(m,h){m.diffuse.value.copy(h.color),m.opacity.value=h.opacity,m.rotation.value=h.rotation,h.map&&(m.map.value=h.map,t(h.map,m.mapTransform)),h.alphaMap&&(m.alphaMap.value=h.alphaMap,t(h.alphaMap,m.alphaMapTransform)),h.alphaTest>0&&(m.alphaTest.value=h.alphaTest)}function u(m,h){m.specular.value.copy(h.specular),m.shininess.value=Math.max(h.shininess,1e-4)}function d(m,h){h.gradientMap&&(m.gradientMap.value=h.gradientMap)}function f(m,h){m.metalness.value=h.metalness,h.metalnessMap&&(m.metalnessMap.value=h.metalnessMap,t(h.metalnessMap,m.metalnessMapTransform)),m.roughness.value=h.roughness,h.roughnessMap&&(m.roughnessMap.value=h.roughnessMap,t(h.roughnessMap,m.roughnessMapTransform)),h.envMap&&(m.envMapIntensity.value=h.envMapIntensity)}function p(m,h,_){m.ior.value=h.ior,h.sheen>0&&(m.sheenColor.value.copy(h.sheenColor).multiplyScalar(h.sheen),m.sheenRoughness.value=h.sheenRoughness,h.sheenColorMap&&(m.sheenColorMap.value=h.sheenColorMap,t(h.sheenColorMap,m.sheenColorMapTransform)),h.sheenRoughnessMap&&(m.sheenRoughnessMap.value=h.sheenRoughnessMap,t(h.sheenRoughnessMap,m.sheenRoughnessMapTransform))),h.clearcoat>0&&(m.clearcoat.value=h.clearcoat,m.clearcoatRoughness.value=h.clearcoatRoughness,h.clearcoatMap&&(m.clearcoatMap.value=h.clearcoatMap,t(h.clearcoatMap,m.clearcoatMapTransform)),h.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=h.clearcoatRoughnessMap,t(h.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),h.clearcoatNormalMap&&(m.clearcoatNormalMap.value=h.clearcoatNormalMap,t(h.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(h.clearcoatNormalScale),h.side===Hn&&m.clearcoatNormalScale.value.negate())),h.dispersion>0&&(m.dispersion.value=h.dispersion),h.iridescence>0&&(m.iridescence.value=h.iridescence,m.iridescenceIOR.value=h.iridescenceIOR,m.iridescenceThicknessMinimum.value=h.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=h.iridescenceThicknessRange[1],h.iridescenceMap&&(m.iridescenceMap.value=h.iridescenceMap,t(h.iridescenceMap,m.iridescenceMapTransform)),h.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=h.iridescenceThicknessMap,t(h.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),h.transmission>0&&(m.transmission.value=h.transmission,m.transmissionSamplerMap.value=_.texture,m.transmissionSamplerSize.value.set(_.width,_.height),h.transmissionMap&&(m.transmissionMap.value=h.transmissionMap,t(h.transmissionMap,m.transmissionMapTransform)),m.thickness.value=h.thickness,h.thicknessMap&&(m.thicknessMap.value=h.thicknessMap,t(h.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=h.attenuationDistance,m.attenuationColor.value.copy(h.attenuationColor)),h.anisotropy>0&&(m.anisotropyVector.value.set(h.anisotropy*Math.cos(h.anisotropyRotation),h.anisotropy*Math.sin(h.anisotropyRotation)),h.anisotropyMap&&(m.anisotropyMap.value=h.anisotropyMap,t(h.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=h.specularIntensity,m.specularColor.value.copy(h.specularColor),h.specularColorMap&&(m.specularColorMap.value=h.specularColorMap,t(h.specularColorMap,m.specularColorMapTransform)),h.specularIntensityMap&&(m.specularIntensityMap.value=h.specularIntensityMap,t(h.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,h){h.matcap&&(m.matcap.value=h.matcap)}function v(m,h){const _=e.get(h).light;m.referencePosition.value.setFromMatrixPosition(_.matrixWorld),m.nearDistance.value=_.shadow.camera.near,m.farDistance.value=_.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:r}}function oR(n,e,t,i){let r={},s={},o=[];const a=n.getParameter(n.MAX_UNIFORM_BUFFER_BINDINGS);function l(_,x){const M=x.program;i.uniformBlockBinding(_,M)}function c(_,x){let M=r[_.id];M===void 0&&(g(_),M=u(_),r[_.id]=M,_.addEventListener("dispose",m));const L=x.program;i.updateUBOMapping(_,L);const A=e.render.frame;s[_.id]!==A&&(f(_),s[_.id]=A)}function u(_){const x=d();_.__bindingPointIndex=x;const M=n.createBuffer(),L=_.__size,A=_.usage;return n.bindBuffer(n.UNIFORM_BUFFER,M),n.bufferData(n.UNIFORM_BUFFER,L,A),n.bindBuffer(n.UNIFORM_BUFFER,null),n.bindBufferBase(n.UNIFORM_BUFFER,x,M),M}function d(){for(let _=0;_<a;_++)if(o.indexOf(_)===-1)return o.push(_),_;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function f(_){const x=r[_.id],M=_.uniforms,L=_.__cache;n.bindBuffer(n.UNIFORM_BUFFER,x);for(let A=0,T=M.length;A<T;A++){const I=Array.isArray(M[A])?M[A]:[M[A]];for(let K=0,y=I.length;K<y;K++){const w=I[K];if(p(w,A,K,L)===!0){const X=w.__offset,W=Array.isArray(w.value)?w.value:[w.value];let $=0;for(let se=0;se<W.length;se++){const j=W[se],Q=v(j);typeof j=="number"||typeof j=="boolean"?(w.__data[0]=j,n.bufferSubData(n.UNIFORM_BUFFER,X+$,w.__data)):j.isMatrix3?(w.__data[0]=j.elements[0],w.__data[1]=j.elements[1],w.__data[2]=j.elements[2],w.__data[3]=0,w.__data[4]=j.elements[3],w.__data[5]=j.elements[4],w.__data[6]=j.elements[5],w.__data[7]=0,w.__data[8]=j.elements[6],w.__data[9]=j.elements[7],w.__data[10]=j.elements[8],w.__data[11]=0):(j.toArray(w.__data,$),$+=Q.storage/Float32Array.BYTES_PER_ELEMENT)}n.bufferSubData(n.UNIFORM_BUFFER,X,w.__data)}}}n.bindBuffer(n.UNIFORM_BUFFER,null)}function p(_,x,M,L){const A=_.value,T=x+"_"+M;if(L[T]===void 0)return typeof A=="number"||typeof A=="boolean"?L[T]=A:L[T]=A.clone(),!0;{const I=L[T];if(typeof A=="number"||typeof A=="boolean"){if(I!==A)return L[T]=A,!0}else if(I.equals(A)===!1)return I.copy(A),!0}return!1}function g(_){const x=_.uniforms;let M=0;const L=16;for(let T=0,I=x.length;T<I;T++){const K=Array.isArray(x[T])?x[T]:[x[T]];for(let y=0,w=K.length;y<w;y++){const X=K[y],W=Array.isArray(X.value)?X.value:[X.value];for(let $=0,se=W.length;$<se;$++){const j=W[$],Q=v(j),U=M%L,ie=U%Q.boundary,re=U+ie;M+=ie,re!==0&&L-re<Q.storage&&(M+=L-re),X.__data=new Float32Array(Q.storage/Float32Array.BYTES_PER_ELEMENT),X.__offset=M,M+=Q.storage}}}const A=M%L;return A>0&&(M+=L-A),_.__size=M,_.__cache={},this}function v(_){const x={boundary:0,storage:0};return typeof _=="number"||typeof _=="boolean"?(x.boundary=4,x.storage=4):_.isVector2?(x.boundary=8,x.storage=8):_.isVector3||_.isColor?(x.boundary=16,x.storage=12):_.isVector4?(x.boundary=16,x.storage=16):_.isMatrix3?(x.boundary=48,x.storage=48):_.isMatrix4?(x.boundary=64,x.storage=64):_.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",_),x}function m(_){const x=_.target;x.removeEventListener("dispose",m);const M=o.indexOf(x.__bindingPointIndex);o.splice(M,1),n.deleteBuffer(r[x.id]),delete r[x.id],delete s[x.id]}function h(){for(const _ in r)n.deleteBuffer(r[_]);o=[],r={},s={}}return{bind:l,update:c,dispose:h}}class aR{constructor(e={}){const{canvas:t=KE(),context:i=null,depth:r=!0,stencil:s=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:u="default",failIfMajorPerformanceCaveat:d=!1}=e;this.isWebGLRenderer=!0;let f;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");f=i.getContextAttributes().alpha}else f=o;const p=new Uint32Array(4),g=new Int32Array(4);let v=null,m=null;const h=[],_=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=Jt,this.toneMapping=dr,this.toneMappingExposure=1;const x=this;let M=!1,L=0,A=0,T=null,I=-1,K=null;const y=new yt,w=new yt;let X=null;const W=new Ke(0);let $=0,se=t.width,j=t.height,Q=1,U=null,ie=null;const re=new yt(0,0,se,j),fe=new yt(0,0,se,j);let Oe=!1;const it=new zp;let Y=!1,ae=!1;const Me=new Ze,ve=new Ze,qe=new N,Fe=new yt,lt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let ge=!1;function Qe(){return T===null?Q:1}let D=i;function mn(E,O){return t.getContext(E,O)}try{const E={alpha:!0,depth:r,stencil:s,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:u,failIfMajorPerformanceCaveat:d};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${Cp}`),t.addEventListener("webglcontextlost",te,!1),t.addEventListener("webglcontextrestored",ye,!1),t.addEventListener("webglcontextcreationerror",ue,!1),D===null){const O="webgl2";if(D=mn(O,E),D===null)throw mn(O)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(E){throw console.error("THREE.WebGLRenderer: "+E.message),E}let Ge,dt,Ue,St,ke,b,S,B,Z,oe,ee,De,pe,we,ct,ce,Ae,Ye,We,be,rt,je,_t,k;function xe(){Ge=new fb(D),Ge.init(),je=new ZA(D,Ge),dt=new ob(D,Ge,e,je),Ue=new KA(D),dt.reverseDepthBuffer&&Ue.buffers.depth.setReversed(!0),St=new mb(D),ke=new DA,b=new $A(D,Ge,Ue,ke,dt,je,St),S=new lb(x),B=new db(x),Z=new M1(D),_t=new rb(D,Z),oe=new hb(D,Z,St,_t),ee=new _b(D,oe,Z,St),We=new gb(D,dt,b),ce=new ab(ke),De=new NA(x,S,B,Ge,dt,_t,ce),pe=new sR(x,ke),we=new UA,ct=new HA(Ge),Ye=new ib(x,S,B,Ue,ee,f,l),Ae=new XA(x,ee,dt),k=new oR(D,St,dt,Ue),be=new sb(D,Ge,St),rt=new pb(D,Ge,St),St.programs=De.programs,x.capabilities=dt,x.extensions=Ge,x.properties=ke,x.renderLists=we,x.shadowMap=Ae,x.state=Ue,x.info=St}xe();const G=new iR(x,D);this.xr=G,this.getContext=function(){return D},this.getContextAttributes=function(){return D.getContextAttributes()},this.forceContextLoss=function(){const E=Ge.get("WEBGL_lose_context");E&&E.loseContext()},this.forceContextRestore=function(){const E=Ge.get("WEBGL_lose_context");E&&E.restoreContext()},this.getPixelRatio=function(){return Q},this.setPixelRatio=function(E){E!==void 0&&(Q=E,this.setSize(se,j,!1))},this.getSize=function(E){return E.set(se,j)},this.setSize=function(E,O,V=!0){if(G.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}se=E,j=O,t.width=Math.floor(E*Q),t.height=Math.floor(O*Q),V===!0&&(t.style.width=E+"px",t.style.height=O+"px"),this.setViewport(0,0,E,O)},this.getDrawingBufferSize=function(E){return E.set(se*Q,j*Q).floor()},this.setDrawingBufferSize=function(E,O,V){se=E,j=O,Q=V,t.width=Math.floor(E*V),t.height=Math.floor(O*V),this.setViewport(0,0,E,O)},this.getCurrentViewport=function(E){return E.copy(y)},this.getViewport=function(E){return E.copy(re)},this.setViewport=function(E,O,V,z){E.isVector4?re.set(E.x,E.y,E.z,E.w):re.set(E,O,V,z),Ue.viewport(y.copy(re).multiplyScalar(Q).round())},this.getScissor=function(E){return E.copy(fe)},this.setScissor=function(E,O,V,z){E.isVector4?fe.set(E.x,E.y,E.z,E.w):fe.set(E,O,V,z),Ue.scissor(w.copy(fe).multiplyScalar(Q).round())},this.getScissorTest=function(){return Oe},this.setScissorTest=function(E){Ue.setScissorTest(Oe=E)},this.setOpaqueSort=function(E){U=E},this.setTransparentSort=function(E){ie=E},this.getClearColor=function(E){return E.copy(Ye.getClearColor())},this.setClearColor=function(){Ye.setClearColor.apply(Ye,arguments)},this.getClearAlpha=function(){return Ye.getClearAlpha()},this.setClearAlpha=function(){Ye.setClearAlpha.apply(Ye,arguments)},this.clear=function(E=!0,O=!0,V=!0){let z=0;if(E){let F=!1;if(T!==null){const de=T.texture.format;F=de===kp||de===Up||de===Ip}if(F){const de=T.texture.type,Se=de===gr||de===Cs||de===rl||de===ko||de===Lp||de===Np,Ce=Ye.getClearColor(),Le=Ye.getClearAlpha(),Be=Ce.r,ze=Ce.g,Ne=Ce.b;Se?(p[0]=Be,p[1]=ze,p[2]=Ne,p[3]=Le,D.clearBufferuiv(D.COLOR,0,p)):(g[0]=Be,g[1]=ze,g[2]=Ne,g[3]=Le,D.clearBufferiv(D.COLOR,0,g))}else z|=D.COLOR_BUFFER_BIT}O&&(z|=D.DEPTH_BUFFER_BIT,D.clearDepth(this.capabilities.reverseDepthBuffer?0:1)),V&&(z|=D.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),D.clear(z)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",te,!1),t.removeEventListener("webglcontextrestored",ye,!1),t.removeEventListener("webglcontextcreationerror",ue,!1),we.dispose(),ct.dispose(),ke.dispose(),S.dispose(),B.dispose(),ee.dispose(),_t.dispose(),k.dispose(),De.dispose(),G.dispose(),G.removeEventListener("sessionstart",Qr),G.removeEventListener("sessionend",Gt),Jn.stop()};function te(E){E.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),M=!0}function ye(){console.log("THREE.WebGLRenderer: Context Restored."),M=!1;const E=St.autoReset,O=Ae.enabled,V=Ae.autoUpdate,z=Ae.needsUpdate,F=Ae.type;xe(),St.autoReset=E,Ae.enabled=O,Ae.autoUpdate=V,Ae.needsUpdate=z,Ae.type=F}function ue(E){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",E.statusMessage)}function Je(E){const O=E.target;O.removeEventListener("dispose",Je),At(O)}function At(E){Yt(E),ke.remove(E)}function Yt(E){const O=ke.get(E).programs;O!==void 0&&(O.forEach(function(V){De.releaseProgram(V)}),E.isShaderMaterial&&De.releaseShaderCache(E))}this.renderBufferDirect=function(E,O,V,z,F,de){O===null&&(O=lt);const Se=F.isMesh&&F.matrixWorld.determinant()<0,Ce=Zo(E,O,V,z,F);Ue.setMaterial(z,Se);let Le=V.index,Be=1;if(z.wireframe===!0){if(Le=oe.getWireframeAttribute(V),Le===void 0)return;Be=2}const ze=V.drawRange,Ne=V.attributes.position;let xt=ze.start*Be,Rt=(ze.start+ze.count)*Be;de!==null&&(xt=Math.max(xt,de.start*Be),Rt=Math.min(Rt,(de.start+de.count)*Be)),Le!==null?(xt=Math.max(xt,0),Rt=Math.min(Rt,Le.count)):Ne!=null&&(xt=Math.max(xt,0),Rt=Math.min(Rt,Ne.count));const Pt=Rt-xt;if(Pt<0||Pt===1/0)return;_t.setup(F,z,Ce,V,Le);let cn,ft=be;if(Le!==null&&(cn=Z.get(Le),ft=rt,ft.setIndex(cn)),F.isMesh)z.wireframe===!0?(Ue.setLineWidth(z.wireframeLinewidth*Qe()),ft.setMode(D.LINES)):ft.setMode(D.TRIANGLES);else if(F.isLine){let Pe=z.linewidth;Pe===void 0&&(Pe=1),Ue.setLineWidth(Pe*Qe()),F.isLineSegments?ft.setMode(D.LINES):F.isLineLoop?ft.setMode(D.LINE_LOOP):ft.setMode(D.LINE_STRIP)}else F.isPoints?ft.setMode(D.POINTS):F.isSprite&&ft.setMode(D.TRIANGLES);if(F.isBatchedMesh)if(F._multiDrawInstances!==null)ft.renderMultiDrawInstances(F._multiDrawStarts,F._multiDrawCounts,F._multiDrawCount,F._multiDrawInstances);else if(Ge.get("WEBGL_multi_draw"))ft.renderMultiDraw(F._multiDrawStarts,F._multiDrawCounts,F._multiDrawCount);else{const Pe=F._multiDrawStarts,Wt=F._multiDrawCounts,ht=F._multiDrawCount,Vn=Le?Z.get(Le).bytesPerElement:1,vr=ke.get(z).currentProgram.getUniforms();for(let Mn=0;Mn<ht;Mn++)vr.setValue(D,"_gl_DrawID",Mn),ft.render(Pe[Mn]/Vn,Wt[Mn])}else if(F.isInstancedMesh)ft.renderInstances(xt,Pt,F.count);else if(V.isInstancedBufferGeometry){const Pe=V._maxInstanceCount!==void 0?V._maxInstanceCount:1/0,Wt=Math.min(V.instanceCount,Pe);ft.renderInstances(xt,Pt,Wt)}else ft.render(xt,Pt)};function ut(E,O,V){E.transparent===!0&&E.side===ki&&E.forceSinglePass===!1?(E.side=Hn,E.needsUpdate=!0,Nn(E,O,V),E.side=Hi,E.needsUpdate=!0,Nn(E,O,V),E.side=ki):Nn(E,O,V)}this.compile=function(E,O,V=null){V===null&&(V=E),m=ct.get(V),m.init(O),_.push(m),V.traverseVisible(function(F){F.isLight&&F.layers.test(O.layers)&&(m.pushLight(F),F.castShadow&&m.pushShadow(F))}),E!==V&&E.traverseVisible(function(F){F.isLight&&F.layers.test(O.layers)&&(m.pushLight(F),F.castShadow&&m.pushShadow(F))}),m.setupLights();const z=new Set;return E.traverse(function(F){if(!(F.isMesh||F.isPoints||F.isLine||F.isSprite))return;const de=F.material;if(de)if(Array.isArray(de))for(let Se=0;Se<de.length;Se++){const Ce=de[Se];ut(Ce,V,F),z.add(Ce)}else ut(de,V,F),z.add(de)}),_.pop(),m=null,z},this.compileAsync=function(E,O,V=null){const z=this.compile(E,O,V);return new Promise(F=>{function de(){if(z.forEach(function(Se){ke.get(Se).currentProgram.isReady()&&z.delete(Se)}),z.size===0){F(E);return}setTimeout(de,10)}Ge.get("KHR_parallel_shader_compile")!==null?de():setTimeout(de,10)})};let ln=null;function Ln(E){ln&&ln(E)}function Qr(){Jn.stop()}function Gt(){Jn.start()}const Jn=new Hv;Jn.setAnimationLoop(Ln),typeof self<"u"&&Jn.setContext(self),this.setAnimationLoop=function(E){ln=E,G.setAnimationLoop(E),E===null?Jn.stop():Jn.start()},G.addEventListener("sessionstart",Qr),G.addEventListener("sessionend",Gt),this.render=function(E,O){if(O!==void 0&&O.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(M===!0)return;if(E.matrixWorldAutoUpdate===!0&&E.updateMatrixWorld(),O.parent===null&&O.matrixWorldAutoUpdate===!0&&O.updateMatrixWorld(),G.enabled===!0&&G.isPresenting===!0&&(G.cameraAutoUpdate===!0&&G.updateCamera(O),O=G.getCamera()),E.isScene===!0&&E.onBeforeRender(x,E,O,T),m=ct.get(E,_.length),m.init(O),_.push(m),ve.multiplyMatrices(O.projectionMatrix,O.matrixWorldInverse),it.setFromProjectionMatrix(ve),ae=this.localClippingEnabled,Y=ce.init(this.clippingPlanes,ae),v=we.get(E,h.length),v.init(),h.push(v),G.enabled===!0&&G.isPresenting===!0){const de=x.xr.getDepthSensingMesh();de!==null&&es(de,O,-1/0,x.sortObjects)}es(E,O,0,x.sortObjects),v.finish(),x.sortObjects===!0&&v.sort(U,ie),ge=G.enabled===!1||G.isPresenting===!1||G.hasDepthSensing()===!1,ge&&Ye.addToRenderList(v,E),this.info.render.frame++,Y===!0&&ce.beginShadows();const V=m.state.shadowsArray;Ae.render(V,E,O),Y===!0&&ce.endShadows(),this.info.autoReset===!0&&this.info.reset();const z=v.opaque,F=v.transmissive;if(m.setupLights(),O.isArrayCamera){const de=O.cameras;if(F.length>0)for(let Se=0,Ce=de.length;Se<Ce;Se++){const Le=de[Se];Qn(z,F,E,Le)}ge&&Ye.render(E);for(let Se=0,Ce=de.length;Se<Ce;Se++){const Le=de[Se];fi(v,E,Le,Le.viewport)}}else F.length>0&&Qn(z,F,E,O),ge&&Ye.render(E),fi(v,E,O);T!==null&&(b.updateMultisampleRenderTarget(T),b.updateRenderTargetMipmap(T)),E.isScene===!0&&E.onAfterRender(x,E,O),_t.resetDefaultState(),I=-1,K=null,_.pop(),_.length>0?(m=_[_.length-1],Y===!0&&ce.setGlobalState(x.clippingPlanes,m.state.camera)):m=null,h.pop(),h.length>0?v=h[h.length-1]:v=null};function es(E,O,V,z){if(E.visible===!1)return;if(E.layers.test(O.layers)){if(E.isGroup)V=E.renderOrder;else if(E.isLOD)E.autoUpdate===!0&&E.update(O);else if(E.isLight)m.pushLight(E),E.castShadow&&m.pushShadow(E);else if(E.isSprite){if(!E.frustumCulled||it.intersectsSprite(E)){z&&Fe.setFromMatrixPosition(E.matrixWorld).applyMatrix4(ve);const Se=ee.update(E),Ce=E.material;Ce.visible&&v.push(E,Se,Ce,V,Fe.z,null)}}else if((E.isMesh||E.isLine||E.isPoints)&&(!E.frustumCulled||it.intersectsObject(E))){const Se=ee.update(E),Ce=E.material;if(z&&(E.boundingSphere!==void 0?(E.boundingSphere===null&&E.computeBoundingSphere(),Fe.copy(E.boundingSphere.center)):(Se.boundingSphere===null&&Se.computeBoundingSphere(),Fe.copy(Se.boundingSphere.center)),Fe.applyMatrix4(E.matrixWorld).applyMatrix4(ve)),Array.isArray(Ce)){const Le=Se.groups;for(let Be=0,ze=Le.length;Be<ze;Be++){const Ne=Le[Be],xt=Ce[Ne.materialIndex];xt&&xt.visible&&v.push(E,Se,xt,V,Fe.z,Ne)}}else Ce.visible&&v.push(E,Se,Ce,V,Fe.z,null)}}const de=E.children;for(let Se=0,Ce=de.length;Se<Ce;Se++)es(de[Se],O,V,z)}function fi(E,O,V,z){const F=E.opaque,de=E.transmissive,Se=E.transparent;m.setupLightsView(V),Y===!0&&ce.setGlobalState(x.clippingPlanes,V),z&&Ue.viewport(y.copy(z)),F.length>0&&ei(F,O,V),de.length>0&&ei(de,O,V),Se.length>0&&ei(Se,O,V),Ue.buffers.depth.setTest(!0),Ue.buffers.depth.setMask(!0),Ue.buffers.color.setMask(!0),Ue.setPolygonOffset(!1)}function Qn(E,O,V,z){if((V.isScene===!0?V.overrideMaterial:null)!==null)return;m.state.transmissionRenderTarget[z.id]===void 0&&(m.state.transmissionRenderTarget[z.id]=new Ps(1,1,{generateMipmaps:!0,type:Ge.has("EXT_color_buffer_half_float")||Ge.has("EXT_color_buffer_float")?hl:gr,minFilter:Oi,samples:4,stencilBuffer:s,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:mt.workingColorSpace}));const de=m.state.transmissionRenderTarget[z.id],Se=z.viewport||y;de.setSize(Se.z,Se.w);const Ce=x.getRenderTarget();x.setRenderTarget(de),x.getClearColor(W),$=x.getClearAlpha(),$<1&&x.setClearColor(16777215,.5),x.clear(),ge&&Ye.render(V);const Le=x.toneMapping;x.toneMapping=dr;const Be=z.viewport;if(z.viewport!==void 0&&(z.viewport=void 0),m.setupLightsView(z),Y===!0&&ce.setGlobalState(x.clippingPlanes,z),ei(E,V,z),b.updateMultisampleRenderTarget(de),b.updateRenderTargetMipmap(de),Ge.has("WEBGL_multisampled_render_to_texture")===!1){let ze=!1;for(let Ne=0,xt=O.length;Ne<xt;Ne++){const Rt=O[Ne],Pt=Rt.object,cn=Rt.geometry,ft=Rt.material,Pe=Rt.group;if(ft.side===ki&&Pt.layers.test(z.layers)){const Wt=ft.side;ft.side=Hn,ft.needsUpdate=!0,Pi(Pt,V,z,cn,ft,Pe),ft.side=Wt,ft.needsUpdate=!0,ze=!0}}ze===!0&&(b.updateMultisampleRenderTarget(de),b.updateRenderTargetMipmap(de))}x.setRenderTarget(Ce),x.setClearColor(W,$),Be!==void 0&&(z.viewport=Be),x.toneMapping=Le}function ei(E,O,V){const z=O.isScene===!0?O.overrideMaterial:null;for(let F=0,de=E.length;F<de;F++){const Se=E[F],Ce=Se.object,Le=Se.geometry,Be=z===null?Se.material:z,ze=Se.group;Ce.layers.test(V.layers)&&Pi(Ce,O,V,Le,Be,ze)}}function Pi(E,O,V,z,F,de){E.onBeforeRender(x,O,V,z,F,de),E.modelViewMatrix.multiplyMatrices(V.matrixWorldInverse,E.matrixWorld),E.normalMatrix.getNormalMatrix(E.modelViewMatrix),F.onBeforeRender(x,O,V,z,E,de),F.transparent===!0&&F.side===ki&&F.forceSinglePass===!1?(F.side=Hn,F.needsUpdate=!0,x.renderBufferDirect(V,O,z,F,E,de),F.side=Hi,F.needsUpdate=!0,x.renderBufferDirect(V,O,z,F,E,de),F.side=ki):x.renderBufferDirect(V,O,z,F,E,de),E.onAfterRender(x,O,V,z,F,de)}function Nn(E,O,V){O.isScene!==!0&&(O=lt);const z=ke.get(E),F=m.state.lights,de=m.state.shadowsArray,Se=F.state.version,Ce=De.getParameters(E,F.state,de,O,V),Le=De.getProgramCacheKey(Ce);let Be=z.programs;z.environment=E.isMeshStandardMaterial?O.environment:null,z.fog=O.fog,z.envMap=(E.isMeshStandardMaterial?B:S).get(E.envMap||z.environment),z.envMapRotation=z.environment!==null&&E.envMap===null?O.environmentRotation:E.envMapRotation,Be===void 0&&(E.addEventListener("dispose",Je),Be=new Map,z.programs=Be);let ze=Be.get(Le);if(ze!==void 0){if(z.currentProgram===ze&&z.lightsStateVersion===Se)return $o(E,Ce),ze}else Ce.uniforms=De.getUniforms(E),E.onBeforeCompile(Ce,x),ze=De.acquireProgram(Ce,Le),Be.set(Le,ze),z.uniforms=Ce.uniforms;const Ne=z.uniforms;return(!E.isShaderMaterial&&!E.isRawShaderMaterial||E.clipping===!0)&&(Ne.clippingPlanes=ce.uniform),$o(E,Ce),z.needsLights=Jo(E),z.lightsStateVersion=Se,z.needsLights&&(Ne.ambientLightColor.value=F.state.ambient,Ne.lightProbe.value=F.state.probe,Ne.directionalLights.value=F.state.directional,Ne.directionalLightShadows.value=F.state.directionalShadow,Ne.spotLights.value=F.state.spot,Ne.spotLightShadows.value=F.state.spotShadow,Ne.rectAreaLights.value=F.state.rectArea,Ne.ltc_1.value=F.state.rectAreaLTC1,Ne.ltc_2.value=F.state.rectAreaLTC2,Ne.pointLights.value=F.state.point,Ne.pointLightShadows.value=F.state.pointShadow,Ne.hemisphereLights.value=F.state.hemi,Ne.directionalShadowMap.value=F.state.directionalShadowMap,Ne.directionalShadowMatrix.value=F.state.directionalShadowMatrix,Ne.spotShadowMap.value=F.state.spotShadowMap,Ne.spotLightMatrix.value=F.state.spotLightMatrix,Ne.spotLightMap.value=F.state.spotLightMap,Ne.pointShadowMap.value=F.state.pointShadowMap,Ne.pointShadowMatrix.value=F.state.pointShadowMatrix),z.currentProgram=ze,z.uniformsList=null,ze}function Us(E){if(E.uniformsList===null){const O=E.currentProgram.getUniforms();E.uniformsList=Pc.seqWithValue(O.seq,E.uniforms)}return E.uniformsList}function $o(E,O){const V=ke.get(E);V.outputColorSpace=O.outputColorSpace,V.batching=O.batching,V.batchingColor=O.batchingColor,V.instancing=O.instancing,V.instancingColor=O.instancingColor,V.instancingMorph=O.instancingMorph,V.skinning=O.skinning,V.morphTargets=O.morphTargets,V.morphNormals=O.morphNormals,V.morphColors=O.morphColors,V.morphTargetsCount=O.morphTargetsCount,V.numClippingPlanes=O.numClippingPlanes,V.numIntersection=O.numClipIntersection,V.vertexAlphas=O.vertexAlphas,V.vertexTangents=O.vertexTangents,V.toneMapping=O.toneMapping}function Zo(E,O,V,z,F){O.isScene!==!0&&(O=lt),b.resetTextureUnits();const de=O.fog,Se=z.isMeshStandardMaterial?O.environment:null,Ce=T===null?x.outputColorSpace:T.isXRRenderTarget===!0?T.texture.colorSpace:an,Le=(z.isMeshStandardMaterial?B:S).get(z.envMap||Se),Be=z.vertexColors===!0&&!!V.attributes.color&&V.attributes.color.itemSize===4,ze=!!V.attributes.tangent&&(!!z.normalMap||z.anisotropy>0),Ne=!!V.morphAttributes.position,xt=!!V.morphAttributes.normal,Rt=!!V.morphAttributes.color;let Pt=dr;z.toneMapped&&(T===null||T.isXRRenderTarget===!0)&&(Pt=x.toneMapping);const cn=V.morphAttributes.position||V.morphAttributes.normal||V.morphAttributes.color,ft=cn!==void 0?cn.length:0,Pe=ke.get(z),Wt=m.state.lights;if(Y===!0&&(ae===!0||E!==K)){const Dn=E===K&&z.id===I;ce.setState(z,E,Dn)}let ht=!1;z.version===Pe.__version?(Pe.needsLights&&Pe.lightsStateVersion!==Wt.state.version||Pe.outputColorSpace!==Ce||F.isBatchedMesh&&Pe.batching===!1||!F.isBatchedMesh&&Pe.batching===!0||F.isBatchedMesh&&Pe.batchingColor===!0&&F.colorTexture===null||F.isBatchedMesh&&Pe.batchingColor===!1&&F.colorTexture!==null||F.isInstancedMesh&&Pe.instancing===!1||!F.isInstancedMesh&&Pe.instancing===!0||F.isSkinnedMesh&&Pe.skinning===!1||!F.isSkinnedMesh&&Pe.skinning===!0||F.isInstancedMesh&&Pe.instancingColor===!0&&F.instanceColor===null||F.isInstancedMesh&&Pe.instancingColor===!1&&F.instanceColor!==null||F.isInstancedMesh&&Pe.instancingMorph===!0&&F.morphTexture===null||F.isInstancedMesh&&Pe.instancingMorph===!1&&F.morphTexture!==null||Pe.envMap!==Le||z.fog===!0&&Pe.fog!==de||Pe.numClippingPlanes!==void 0&&(Pe.numClippingPlanes!==ce.numPlanes||Pe.numIntersection!==ce.numIntersection)||Pe.vertexAlphas!==Be||Pe.vertexTangents!==ze||Pe.morphTargets!==Ne||Pe.morphNormals!==xt||Pe.morphColors!==Rt||Pe.toneMapping!==Pt||Pe.morphTargetsCount!==ft)&&(ht=!0):(ht=!0,Pe.__version=z.version);let Vn=Pe.currentProgram;ht===!0&&(Vn=Nn(z,O,F));let vr=!1,Mn=!1,Qo=!1;const kt=Vn.getUniforms(),Li=Pe.uniforms;if(Ue.useProgram(Vn.program)&&(vr=!0,Mn=!0,Qo=!0),z.id!==I&&(I=z.id,Mn=!0),vr||K!==E){dt.reverseDepthBuffer?(Me.copy(E.projectionMatrix),$E(Me),ZE(Me),kt.setValue(D,"projectionMatrix",Me)):kt.setValue(D,"projectionMatrix",E.projectionMatrix),kt.setValue(D,"viewMatrix",E.matrixWorldInverse);const Dn=kt.map.cameraPosition;Dn!==void 0&&Dn.setValue(D,qe.setFromMatrixPosition(E.matrixWorld)),dt.logarithmicDepthBuffer&&kt.setValue(D,"logDepthBufFC",2/(Math.log(E.far+1)/Math.LN2)),(z.isMeshPhongMaterial||z.isMeshToonMaterial||z.isMeshLambertMaterial||z.isMeshBasicMaterial||z.isMeshStandardMaterial||z.isShaderMaterial)&&kt.setValue(D,"isOrthographic",E.isOrthographicCamera===!0),K!==E&&(K=E,Mn=!0,Qo=!0)}if(F.isSkinnedMesh){kt.setOptional(D,F,"bindMatrix"),kt.setOptional(D,F,"bindMatrixInverse");const Dn=F.skeleton;Dn&&(Dn.boneTexture===null&&Dn.computeBoneTexture(),kt.setValue(D,"boneTexture",Dn.boneTexture,b))}F.isBatchedMesh&&(kt.setOptional(D,F,"batchingTexture"),kt.setValue(D,"batchingTexture",F._matricesTexture,b),kt.setOptional(D,F,"batchingIdTexture"),kt.setValue(D,"batchingIdTexture",F._indirectTexture,b),kt.setOptional(D,F,"batchingColorTexture"),F._colorsTexture!==null&&kt.setValue(D,"batchingColorTexture",F._colorsTexture,b));const ks=V.morphAttributes;if((ks.position!==void 0||ks.normal!==void 0||ks.color!==void 0)&&We.update(F,V,Vn),(Mn||Pe.receiveShadow!==F.receiveShadow)&&(Pe.receiveShadow=F.receiveShadow,kt.setValue(D,"receiveShadow",F.receiveShadow)),z.isMeshGouraudMaterial&&z.envMap!==null&&(Li.envMap.value=Le,Li.flipEnvMap.value=Le.isCubeTexture&&Le.isRenderTargetTexture===!1?-1:1),z.isMeshStandardMaterial&&z.envMap===null&&O.environment!==null&&(Li.envMapIntensity.value=O.environmentIntensity),Mn&&(kt.setValue(D,"toneMappingExposure",x.toneMappingExposure),Pe.needsLights&&xr(Li,Qo),de&&z.fog===!0&&pe.refreshFogUniforms(Li,de),pe.refreshMaterialUniforms(Li,z,Q,j,m.state.transmissionRenderTarget[E.id]),Pc.upload(D,Us(Pe),Li,b)),z.isShaderMaterial&&z.uniformsNeedUpdate===!0&&(Pc.upload(D,Us(Pe),Li,b),z.uniformsNeedUpdate=!1),z.isSpriteMaterial&&kt.setValue(D,"center",F.center),kt.setValue(D,"modelViewMatrix",F.modelViewMatrix),kt.setValue(D,"normalMatrix",F.normalMatrix),kt.setValue(D,"modelMatrix",F.matrixWorld),z.isShaderMaterial||z.isRawShaderMaterial){const Dn=z.uniformsGroups;for(let ea=0,Lu=Dn.length;ea<Lu;ea++){const gl=Dn[ea];k.update(gl,Vn),k.bind(gl,Vn)}}return Vn}function xr(E,O){E.ambientLightColor.needsUpdate=O,E.lightProbe.needsUpdate=O,E.directionalLights.needsUpdate=O,E.directionalLightShadows.needsUpdate=O,E.pointLights.needsUpdate=O,E.pointLightShadows.needsUpdate=O,E.spotLights.needsUpdate=O,E.spotLightShadows.needsUpdate=O,E.rectAreaLights.needsUpdate=O,E.hemisphereLights.needsUpdate=O}function Jo(E){return E.isMeshLambertMaterial||E.isMeshToonMaterial||E.isMeshPhongMaterial||E.isMeshStandardMaterial||E.isShadowMaterial||E.isShaderMaterial&&E.lights===!0}this.getActiveCubeFace=function(){return L},this.getActiveMipmapLevel=function(){return A},this.getRenderTarget=function(){return T},this.setRenderTargetTextures=function(E,O,V){ke.get(E.texture).__webglTexture=O,ke.get(E.depthTexture).__webglTexture=V;const z=ke.get(E);z.__hasExternalTextures=!0,z.__autoAllocateDepthBuffer=V===void 0,z.__autoAllocateDepthBuffer||Ge.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),z.__useRenderToTexture=!1)},this.setRenderTargetFramebuffer=function(E,O){const V=ke.get(E);V.__webglFramebuffer=O,V.__useDefaultFramebuffer=O===void 0},this.setRenderTarget=function(E,O=0,V=0){T=E,L=O,A=V;let z=!0,F=null,de=!1,Se=!1;if(E){const Le=ke.get(E);if(Le.__useDefaultFramebuffer!==void 0)Ue.bindFramebuffer(D.FRAMEBUFFER,null),z=!1;else if(Le.__webglFramebuffer===void 0)b.setupRenderTarget(E);else if(Le.__hasExternalTextures)b.rebindTextures(E,ke.get(E.texture).__webglTexture,ke.get(E.depthTexture).__webglTexture);else if(E.depthBuffer){const Ne=E.depthTexture;if(Le.__boundDepthTexture!==Ne){if(Ne!==null&&ke.has(Ne)&&(E.width!==Ne.image.width||E.height!==Ne.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");b.setupDepthRenderbuffer(E)}}const Be=E.texture;(Be.isData3DTexture||Be.isDataArrayTexture||Be.isCompressedArrayTexture)&&(Se=!0);const ze=ke.get(E).__webglFramebuffer;E.isWebGLCubeRenderTarget?(Array.isArray(ze[O])?F=ze[O][V]:F=ze[O],de=!0):E.samples>0&&b.useMultisampledRTT(E)===!1?F=ke.get(E).__webglMultisampledFramebuffer:Array.isArray(ze)?F=ze[V]:F=ze,y.copy(E.viewport),w.copy(E.scissor),X=E.scissorTest}else y.copy(re).multiplyScalar(Q).floor(),w.copy(fe).multiplyScalar(Q).floor(),X=Oe;if(Ue.bindFramebuffer(D.FRAMEBUFFER,F)&&z&&Ue.drawBuffers(E,F),Ue.viewport(y),Ue.scissor(w),Ue.setScissorTest(X),de){const Le=ke.get(E.texture);D.framebufferTexture2D(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_CUBE_MAP_POSITIVE_X+O,Le.__webglTexture,V)}else if(Se){const Le=ke.get(E.texture),Be=O||0;D.framebufferTextureLayer(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0,Le.__webglTexture,V||0,Be)}I=-1},this.readRenderTargetPixels=function(E,O,V,z,F,de,Se){if(!(E&&E.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Ce=ke.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&Se!==void 0&&(Ce=Ce[Se]),Ce){Ue.bindFramebuffer(D.FRAMEBUFFER,Ce);try{const Le=E.texture,Be=Le.format,ze=Le.type;if(!dt.textureFormatReadable(Be)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!dt.textureTypeReadable(ze)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}O>=0&&O<=E.width-z&&V>=0&&V<=E.height-F&&D.readPixels(O,V,z,F,je.convert(Be),je.convert(ze),de)}finally{const Le=T!==null?ke.get(T).__webglFramebuffer:null;Ue.bindFramebuffer(D.FRAMEBUFFER,Le)}}},this.readRenderTargetPixelsAsync=async function(E,O,V,z,F,de,Se){if(!(E&&E.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Ce=ke.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&Se!==void 0&&(Ce=Ce[Se]),Ce){const Le=E.texture,Be=Le.format,ze=Le.type;if(!dt.textureFormatReadable(Be))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!dt.textureTypeReadable(ze))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");if(O>=0&&O<=E.width-z&&V>=0&&V<=E.height-F){Ue.bindFramebuffer(D.FRAMEBUFFER,Ce);const Ne=D.createBuffer();D.bindBuffer(D.PIXEL_PACK_BUFFER,Ne),D.bufferData(D.PIXEL_PACK_BUFFER,de.byteLength,D.STREAM_READ),D.readPixels(O,V,z,F,je.convert(Be),je.convert(ze),0);const xt=T!==null?ke.get(T).__webglFramebuffer:null;Ue.bindFramebuffer(D.FRAMEBUFFER,xt);const Rt=D.fenceSync(D.SYNC_GPU_COMMANDS_COMPLETE,0);return D.flush(),await qE(D,Rt,4),D.bindBuffer(D.PIXEL_PACK_BUFFER,Ne),D.getBufferSubData(D.PIXEL_PACK_BUFFER,0,de),D.deleteBuffer(Ne),D.deleteSync(Rt),de}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")}},this.copyFramebufferToTexture=function(E,O=null,V=0){E.isTexture!==!0&&(Cc("WebGLRenderer: copyFramebufferToTexture function signature has changed."),O=arguments[0]||null,E=arguments[1]);const z=Math.pow(2,-V),F=Math.floor(E.image.width*z),de=Math.floor(E.image.height*z),Se=O!==null?O.x:0,Ce=O!==null?O.y:0;b.setTexture2D(E,0),D.copyTexSubImage2D(D.TEXTURE_2D,V,0,0,Se,Ce,F,de),Ue.unbindTexture()},this.copyTextureToTexture=function(E,O,V=null,z=null,F=0){E.isTexture!==!0&&(Cc("WebGLRenderer: copyTextureToTexture function signature has changed."),z=arguments[0]||null,E=arguments[1],O=arguments[2],F=arguments[3]||0,V=null);let de,Se,Ce,Le,Be,ze;V!==null?(de=V.max.x-V.min.x,Se=V.max.y-V.min.y,Ce=V.min.x,Le=V.min.y):(de=E.image.width,Se=E.image.height,Ce=0,Le=0),z!==null?(Be=z.x,ze=z.y):(Be=0,ze=0);const Ne=je.convert(O.format),xt=je.convert(O.type);b.setTexture2D(O,0),D.pixelStorei(D.UNPACK_FLIP_Y_WEBGL,O.flipY),D.pixelStorei(D.UNPACK_PREMULTIPLY_ALPHA_WEBGL,O.premultiplyAlpha),D.pixelStorei(D.UNPACK_ALIGNMENT,O.unpackAlignment);const Rt=D.getParameter(D.UNPACK_ROW_LENGTH),Pt=D.getParameter(D.UNPACK_IMAGE_HEIGHT),cn=D.getParameter(D.UNPACK_SKIP_PIXELS),ft=D.getParameter(D.UNPACK_SKIP_ROWS),Pe=D.getParameter(D.UNPACK_SKIP_IMAGES),Wt=E.isCompressedTexture?E.mipmaps[F]:E.image;D.pixelStorei(D.UNPACK_ROW_LENGTH,Wt.width),D.pixelStorei(D.UNPACK_IMAGE_HEIGHT,Wt.height),D.pixelStorei(D.UNPACK_SKIP_PIXELS,Ce),D.pixelStorei(D.UNPACK_SKIP_ROWS,Le),E.isDataTexture?D.texSubImage2D(D.TEXTURE_2D,F,Be,ze,de,Se,Ne,xt,Wt.data):E.isCompressedTexture?D.compressedTexSubImage2D(D.TEXTURE_2D,F,Be,ze,Wt.width,Wt.height,Ne,Wt.data):D.texSubImage2D(D.TEXTURE_2D,F,Be,ze,de,Se,Ne,xt,Wt),D.pixelStorei(D.UNPACK_ROW_LENGTH,Rt),D.pixelStorei(D.UNPACK_IMAGE_HEIGHT,Pt),D.pixelStorei(D.UNPACK_SKIP_PIXELS,cn),D.pixelStorei(D.UNPACK_SKIP_ROWS,ft),D.pixelStorei(D.UNPACK_SKIP_IMAGES,Pe),F===0&&O.generateMipmaps&&D.generateMipmap(D.TEXTURE_2D),Ue.unbindTexture()},this.copyTextureToTexture3D=function(E,O,V=null,z=null,F=0){E.isTexture!==!0&&(Cc("WebGLRenderer: copyTextureToTexture3D function signature has changed."),V=arguments[0]||null,z=arguments[1]||null,E=arguments[2],O=arguments[3],F=arguments[4]||0);let de,Se,Ce,Le,Be,ze,Ne,xt,Rt;const Pt=E.isCompressedTexture?E.mipmaps[F]:E.image;V!==null?(de=V.max.x-V.min.x,Se=V.max.y-V.min.y,Ce=V.max.z-V.min.z,Le=V.min.x,Be=V.min.y,ze=V.min.z):(de=Pt.width,Se=Pt.height,Ce=Pt.depth,Le=0,Be=0,ze=0),z!==null?(Ne=z.x,xt=z.y,Rt=z.z):(Ne=0,xt=0,Rt=0);const cn=je.convert(O.format),ft=je.convert(O.type);let Pe;if(O.isData3DTexture)b.setTexture3D(O,0),Pe=D.TEXTURE_3D;else if(O.isDataArrayTexture||O.isCompressedArrayTexture)b.setTexture2DArray(O,0),Pe=D.TEXTURE_2D_ARRAY;else{console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: only supports THREE.DataTexture3D and THREE.DataTexture2DArray.");return}D.pixelStorei(D.UNPACK_FLIP_Y_WEBGL,O.flipY),D.pixelStorei(D.UNPACK_PREMULTIPLY_ALPHA_WEBGL,O.premultiplyAlpha),D.pixelStorei(D.UNPACK_ALIGNMENT,O.unpackAlignment);const Wt=D.getParameter(D.UNPACK_ROW_LENGTH),ht=D.getParameter(D.UNPACK_IMAGE_HEIGHT),Vn=D.getParameter(D.UNPACK_SKIP_PIXELS),vr=D.getParameter(D.UNPACK_SKIP_ROWS),Mn=D.getParameter(D.UNPACK_SKIP_IMAGES);D.pixelStorei(D.UNPACK_ROW_LENGTH,Pt.width),D.pixelStorei(D.UNPACK_IMAGE_HEIGHT,Pt.height),D.pixelStorei(D.UNPACK_SKIP_PIXELS,Le),D.pixelStorei(D.UNPACK_SKIP_ROWS,Be),D.pixelStorei(D.UNPACK_SKIP_IMAGES,ze),E.isDataTexture||E.isData3DTexture?D.texSubImage3D(Pe,F,Ne,xt,Rt,de,Se,Ce,cn,ft,Pt.data):O.isCompressedArrayTexture?D.compressedTexSubImage3D(Pe,F,Ne,xt,Rt,de,Se,Ce,cn,Pt.data):D.texSubImage3D(Pe,F,Ne,xt,Rt,de,Se,Ce,cn,ft,Pt),D.pixelStorei(D.UNPACK_ROW_LENGTH,Wt),D.pixelStorei(D.UNPACK_IMAGE_HEIGHT,ht),D.pixelStorei(D.UNPACK_SKIP_PIXELS,Vn),D.pixelStorei(D.UNPACK_SKIP_ROWS,vr),D.pixelStorei(D.UNPACK_SKIP_IMAGES,Mn),F===0&&O.generateMipmaps&&D.generateMipmap(Pe),Ue.unbindTexture()},this.initRenderTarget=function(E){ke.get(E).__webglFramebuffer===void 0&&b.setupRenderTarget(E)},this.initTexture=function(E){E.isCubeTexture?b.setTextureCube(E,0):E.isData3DTexture?b.setTexture3D(E,0):E.isDataArrayTexture||E.isCompressedArrayTexture?b.setTexture2DArray(E,0):b.setTexture2D(E,0),Ue.unbindTexture()},this.resetState=function(){L=0,A=0,T=null,Ue.reset(),_t.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return lr}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=e===Op?"display-p3":"srgb",t.unpackColorSpace=mt.workingColorSpace===Au?"display-p3":"srgb"}}class lR extends Bt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Gi,this.environmentIntensity=1,this.environmentRotation=new Gi,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}}class cR{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=bh,this.updateRanges=[],this.version=0,this.uuid=Ti()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,i){e*=this.stride,i*=t.stride;for(let r=0,s=this.stride;r<s;r++)this.array[e+r]=t.array[i+r];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Ti()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),i=new this.constructor(t,this.stride);return i.setUsage(this.usage),i}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){return e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Ti()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const En=new N;class Gp{constructor(e,t,i,r=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=i,this.normalized=r}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,i=this.data.count;t<i;t++)En.fromBufferAttribute(this,t),En.applyMatrix4(e),this.setXYZ(t,En.x,En.y,En.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)En.fromBufferAttribute(this,t),En.applyNormalMatrix(e),this.setXYZ(t,En.x,En.y,En.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)En.fromBufferAttribute(this,t),En.transformDirection(e),this.setXYZ(t,En.x,En.y,En.z);return this}getComponent(e,t){let i=this.array[e*this.data.stride+this.offset+t];return this.normalized&&(i=yi(i,this.array)),i}setComponent(e,t,i){return this.normalized&&(i=Mt(i,this.array)),this.data.array[e*this.data.stride+this.offset+t]=i,this}setX(e,t){return this.normalized&&(t=Mt(t,this.array)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=Mt(t,this.array)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=Mt(t,this.array)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=Mt(t,this.array)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=yi(t,this.array)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=yi(t,this.array)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=yi(t,this.array)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=yi(t,this.array)),t}setXY(e,t,i){return e=e*this.data.stride+this.offset,this.normalized&&(t=Mt(t,this.array),i=Mt(i,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=i,this}setXYZ(e,t,i,r){return e=e*this.data.stride+this.offset,this.normalized&&(t=Mt(t,this.array),i=Mt(i,this.array),r=Mt(r,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=i,this.data.array[e+2]=r,this}setXYZW(e,t,i,r,s){return e=e*this.data.stride+this.offset,this.normalized&&(t=Mt(t,this.array),i=Mt(i,this.array),r=Mt(r,this.array),s=Mt(s,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=i,this.data.array[e+2]=r,this.data.array[e+3]=s,this}clone(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let i=0;i<this.count;i++){const r=i*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[r+s])}return new hn(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new Gp(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let i=0;i<this.count;i++){const r=i*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[r+s])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}const g0=new N,_0=new yt,x0=new yt,uR=new N,v0=new Ze,nc=new N,Id=new Ci,y0=new Ze,Ud=new Xo;class dR extends Yn{constructor(e,t){super(e,t),this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode=Mg,this.bindMatrix=new Ze,this.bindMatrixInverse=new Ze,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){const e=this.geometry;this.boundingBox===null&&(this.boundingBox=new Ri),this.boundingBox.makeEmpty();const t=e.getAttribute("position");for(let i=0;i<t.count;i++)this.getVertexPosition(i,nc),this.boundingBox.expandByPoint(nc)}computeBoundingSphere(){const e=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new Ci),this.boundingSphere.makeEmpty();const t=e.getAttribute("position");for(let i=0;i<t.count;i++)this.getVertexPosition(i,nc),this.boundingSphere.expandByPoint(nc)}copy(e,t){return super.copy(e,t),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}raycast(e,t){const i=this.material,r=this.matrixWorld;i!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Id.copy(this.boundingSphere),Id.applyMatrix4(r),e.ray.intersectsSphere(Id)!==!1&&(y0.copy(r).invert(),Ud.copy(e.ray).applyMatrix4(y0),!(this.boundingBox!==null&&Ud.intersectsBox(this.boundingBox)===!1)&&this._computeIntersections(e,t,Ud)))}getVertexPosition(e,t){return super.getVertexPosition(e,t),this.applyBoneTransform(e,t),t}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){const e=new yt,t=this.geometry.attributes.skinWeight;for(let i=0,r=t.count;i<r;i++){e.fromBufferAttribute(t,i);const s=1/e.manhattanLength();s!==1/0?e.multiplyScalar(s):e.set(1,0,0,0),t.setXYZW(i,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode===Mg?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===vE?this.bindMatrixInverse.copy(this.bindMatrix).invert():console.warn("THREE.SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(e,t){const i=this.skeleton,r=this.geometry;_0.fromBufferAttribute(r.attributes.skinIndex,e),x0.fromBufferAttribute(r.attributes.skinWeight,e),g0.copy(t).applyMatrix4(this.bindMatrix),t.set(0,0,0);for(let s=0;s<4;s++){const o=x0.getComponent(s);if(o!==0){const a=_0.getComponent(s);v0.multiplyMatrices(i.bones[a].matrixWorld,i.boneInverses[a]),t.addScaledVector(uR.copy(g0).applyMatrix4(v0),o)}}return t.applyMatrix4(this.bindMatrixInverse)}}class Yv extends Bt{constructor(){super(),this.isBone=!0,this.type="Bone"}}class Kv extends on{constructor(e=null,t=1,i=1,r,s,o,a,l,c=An,u=An,d,f){super(null,o,a,l,c,u,r,s,d,f),this.isDataTexture=!0,this.image={data:e,width:t,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}const S0=new Ze,fR=new Ze;class Wp{constructor(e=[],t=[]){this.uuid=Ti(),this.bones=e.slice(0),this.boneInverses=t,this.boneMatrices=null,this.boneTexture=null,this.init()}init(){const e=this.bones,t=this.boneInverses;if(this.boneMatrices=new Float32Array(e.length*16),t.length===0)this.calculateInverses();else if(e.length!==t.length){console.warn("THREE.Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let i=0,r=this.bones.length;i<r;i++)this.boneInverses.push(new Ze)}}calculateInverses(){this.boneInverses.length=0;for(let e=0,t=this.bones.length;e<t;e++){const i=new Ze;this.bones[e]&&i.copy(this.bones[e].matrixWorld).invert(),this.boneInverses.push(i)}}pose(){for(let e=0,t=this.bones.length;e<t;e++){const i=this.bones[e];i&&i.matrixWorld.copy(this.boneInverses[e]).invert()}for(let e=0,t=this.bones.length;e<t;e++){const i=this.bones[e];i&&(i.parent&&i.parent.isBone?(i.matrix.copy(i.parent.matrixWorld).invert(),i.matrix.multiply(i.matrixWorld)):i.matrix.copy(i.matrixWorld),i.matrix.decompose(i.position,i.quaternion,i.scale))}}update(){const e=this.bones,t=this.boneInverses,i=this.boneMatrices,r=this.boneTexture;for(let s=0,o=e.length;s<o;s++){const a=e[s]?e[s].matrixWorld:fR;S0.multiplyMatrices(a,t[s]),S0.toArray(i,s*16)}r!==null&&(r.needsUpdate=!0)}clone(){return new Wp(this.bones,this.boneInverses)}computeBoneTexture(){let e=Math.sqrt(this.bones.length*4);e=Math.ceil(e/4)*4,e=Math.max(e,4);const t=new Float32Array(e*e*4);t.set(this.boneMatrices);const i=new Kv(t,e,e,ai,Mi);return i.needsUpdate=!0,this.boneMatrices=t,this.boneTexture=i,this}getBoneByName(e){for(let t=0,i=this.bones.length;t<i;t++){const r=this.bones[t];if(r.name===e)return r}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(e,t){this.uuid=e.uuid;for(let i=0,r=e.bones.length;i<r;i++){const s=e.bones[i];let o=t[s];o===void 0&&(console.warn("THREE.Skeleton: No bone found with UUID:",s),o=new Yv),this.bones.push(o),this.boneInverses.push(new Ze().fromArray(e.boneInverses[i]))}return this.init(),this}toJSON(){const e={metadata:{version:4.6,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};e.uuid=this.uuid;const t=this.bones,i=this.boneInverses;for(let r=0,s=t.length;r<s;r++){const o=t[r];e.bones.push(o.uuid);const a=i[r];e.boneInverses.push(a.toArray())}return e}}class Rh extends hn{constructor(e,t,i,r=1){super(e,t,i),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){const e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}}const Js=new Ze,M0=new Ze,ic=[],E0=new Ri,hR=new Ze,ma=new Yn,ga=new Ci;class pR extends Yn{constructor(e,t,i){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new Rh(new Float32Array(i*16),16),this.instanceColor=null,this.morphTexture=null,this.count=i,this.boundingBox=null,this.boundingSphere=null;for(let r=0;r<i;r++)this.setMatrixAt(r,hR)}computeBoundingBox(){const e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new Ri),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,Js),E0.copy(e.boundingBox).applyMatrix4(Js),this.boundingBox.union(E0)}computeBoundingSphere(){const e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new Ci),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,Js),ga.copy(e.boundingSphere).applyMatrix4(Js),this.boundingSphere.union(ga)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){const i=t.morphTargetInfluences,r=this.morphTexture.source.data.data,s=i.length+1,o=e*s+1;for(let a=0;a<i.length;a++)i[a]=r[o+a]}raycast(e,t){const i=this.matrixWorld,r=this.count;if(ma.geometry=this.geometry,ma.material=this.material,ma.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),ga.copy(this.boundingSphere),ga.applyMatrix4(i),e.ray.intersectsSphere(ga)!==!1))for(let s=0;s<r;s++){this.getMatrixAt(s,Js),M0.multiplyMatrices(i,Js),ma.matrixWorld=M0,ma.raycast(e,ic);for(let o=0,a=ic.length;o<a;o++){const l=ic[o];l.instanceId=s,l.object=this,t.push(l)}ic.length=0}}setColorAt(e,t){this.instanceColor===null&&(this.instanceColor=new Rh(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3)}setMatrixAt(e,t){t.toArray(this.instanceMatrix.array,e*16)}setMorphAt(e,t){const i=t.morphTargetInfluences,r=i.length+1;this.morphTexture===null&&(this.morphTexture=new Kv(new Float32Array(r*this.count),r,this.count,Dp,Mi));const s=this.morphTexture.source.data.data;let o=0;for(let c=0;c<i.length;c++)o+=i[c];const a=this.geometry.morphTargetsRelative?1:1-o,l=r*e;s[l]=a,s.set(i,l+1)}updateMorphTargets(){}dispose(){return this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null),this}}class jp extends zi{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Ke(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}}const ou=new N,au=new N,w0=new Ze,_a=new Xo,rc=new Ci,kd=new N,T0=new N;class Xp extends Bt{constructor(e=new di,t=new jp){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,i=[0];for(let r=1,s=t.count;r<s;r++)ou.fromBufferAttribute(t,r-1),au.fromBufferAttribute(t,r),i[r]=i[r-1],i[r]+=ou.distanceTo(au);e.setAttribute("lineDistance",new bi(i,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,t){const i=this.geometry,r=this.matrixWorld,s=e.params.Line.threshold,o=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),rc.copy(i.boundingSphere),rc.applyMatrix4(r),rc.radius+=s,e.ray.intersectsSphere(rc)===!1)return;w0.copy(r).invert(),_a.copy(e.ray).applyMatrix4(w0);const a=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=this.isLineSegments?2:1,u=i.index,f=i.attributes.position;if(u!==null){const p=Math.max(0,o.start),g=Math.min(u.count,o.start+o.count);for(let v=p,m=g-1;v<m;v+=c){const h=u.getX(v),_=u.getX(v+1),x=sc(this,e,_a,l,h,_);x&&t.push(x)}if(this.isLineLoop){const v=u.getX(g-1),m=u.getX(p),h=sc(this,e,_a,l,v,m);h&&t.push(h)}}else{const p=Math.max(0,o.start),g=Math.min(f.count,o.start+o.count);for(let v=p,m=g-1;v<m;v+=c){const h=sc(this,e,_a,l,v,v+1);h&&t.push(h)}if(this.isLineLoop){const v=sc(this,e,_a,l,g-1,p);v&&t.push(v)}}}updateMorphTargets(){const t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){const r=t[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=r.length;s<o;s++){const a=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}}function sc(n,e,t,i,r,s){const o=n.geometry.attributes.position;if(ou.fromBufferAttribute(o,r),au.fromBufferAttribute(o,s),t.distanceSqToSegment(ou,au,kd,T0)>i)return;kd.applyMatrix4(n.matrixWorld);const l=e.ray.origin.distanceTo(kd);if(!(l<e.near||l>e.far))return{distance:l,point:T0.clone().applyMatrix4(n.matrixWorld),index:r,face:null,faceIndex:null,barycoord:null,object:n}}const b0=new N,A0=new N;class qv extends Xp{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,i=[];for(let r=0,s=t.count;r<s;r+=2)b0.fromBufferAttribute(t,r),A0.fromBufferAttribute(t,r+1),i[r]=r===0?0:i[r-1],i[r+1]=i[r]+b0.distanceTo(A0);e.setAttribute("lineDistance",new bi(i,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class mR extends Xp{constructor(e,t){super(e,t),this.isLineLoop=!0,this.type="LineLoop"}}class $v extends zi{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Ke(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}const R0=new Ze,Ch=new Xo,oc=new Ci,ac=new N;class gR extends Bt{constructor(e=new di,t=new $v){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){const i=this.geometry,r=this.matrixWorld,s=e.params.Points.threshold,o=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),oc.copy(i.boundingSphere),oc.applyMatrix4(r),oc.radius+=s,e.ray.intersectsSphere(oc)===!1)return;R0.copy(r).invert(),Ch.copy(e.ray).applyMatrix4(R0);const a=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=i.index,d=i.attributes.position;if(c!==null){const f=Math.max(0,o.start),p=Math.min(c.count,o.start+o.count);for(let g=f,v=p;g<v;g++){const m=c.getX(g);ac.fromBufferAttribute(d,m),C0(ac,m,l,r,e,t,this)}}else{const f=Math.max(0,o.start),p=Math.min(d.count,o.start+o.count);for(let g=f,v=p;g<v;g++)ac.fromBufferAttribute(d,g),C0(ac,g,l,r,e,t,this)}}updateMorphTargets(){const t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){const r=t[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=r.length;s<o;s++){const a=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}}function C0(n,e,t,i,r,s,o){const a=Ch.distanceSqToPoint(n);if(a<t){const l=new N;Ch.closestPointToPoint(n,l),l.applyMatrix4(i);const c=r.ray.origin.distanceTo(l);if(c<r.near||c>r.far)return;s.push({distance:c,distanceToRay:Math.sqrt(a),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:o})}}class Yp extends zi{constructor(e){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.type="MeshStandardMaterial",this.color=new Ke(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ke(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Cv,this.normalScale=new He(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Gi,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class Wi extends Yp{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new He(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return dn(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new Ke(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new Ke(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new Ke(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}}function lc(n,e,t){return!n||!t&&n.constructor===e?n:typeof e.BYTES_PER_ELEMENT=="number"?new e(n):Array.prototype.slice.call(n)}function _R(n){return ArrayBuffer.isView(n)&&!(n instanceof DataView)}function xR(n){function e(r,s){return n[r]-n[s]}const t=n.length,i=new Array(t);for(let r=0;r!==t;++r)i[r]=r;return i.sort(e),i}function P0(n,e,t){const i=n.length,r=new n.constructor(i);for(let s=0,o=0;o!==i;++s){const a=t[s]*e;for(let l=0;l!==e;++l)r[o++]=n[a+l]}return r}function Zv(n,e,t,i){let r=1,s=n[0];for(;s!==void 0&&s[i]===void 0;)s=n[r++];if(s===void 0)return;let o=s[i];if(o!==void 0)if(Array.isArray(o))do o=s[i],o!==void 0&&(e.push(s.time),t.push.apply(t,o)),s=n[r++];while(s!==void 0);else if(o.toArray!==void 0)do o=s[i],o!==void 0&&(e.push(s.time),o.toArray(t,t.length)),s=n[r++];while(s!==void 0);else do o=s[i],o!==void 0&&(e.push(s.time),t.push(o)),s=n[r++];while(s!==void 0)}class ml{constructor(e,t,i,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r!==void 0?r:new t.constructor(i),this.sampleValues=t,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(e){const t=this.parameterPositions;let i=this._cachedIndex,r=t[i],s=t[i-1];e:{t:{let o;n:{i:if(!(e<r)){for(let a=i+2;;){if(r===void 0){if(e<s)break i;return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===a)break;if(s=r,r=t[++i],e<r)break t}o=t.length;break n}if(!(e>=s)){const a=t[1];e<a&&(i=2,s=a);for(let l=i-2;;){if(s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===l)break;if(r=s,s=t[--i-1],e>=s)break t}o=i,i=0;break n}break e}for(;i<o;){const a=i+o>>>1;e<t[a]?o=a:i=a+1}if(r=t[i],s=t[i-1],s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,s,r)}return this.interpolate_(i,s,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){const t=this.resultBuffer,i=this.sampleValues,r=this.valueSize,s=e*r;for(let o=0;o!==r;++o)t[o]=i[s+o];return t}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}}class vR extends ml{constructor(e,t,i,r){super(e,t,i,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Eg,endingEnd:Eg}}intervalChanged_(e,t,i){const r=this.parameterPositions;let s=e-2,o=e+1,a=r[s],l=r[o];if(a===void 0)switch(this.getSettings_().endingStart){case wg:s=e,a=2*t-i;break;case Tg:s=r.length-2,a=t+r[s]-r[s+1];break;default:s=e,a=i}if(l===void 0)switch(this.getSettings_().endingEnd){case wg:o=e,l=2*i-t;break;case Tg:o=1,l=i+r[1]-r[0];break;default:o=e-1,l=t}const c=(i-t)*.5,u=this.valueSize;this._weightPrev=c/(t-a),this._weightNext=c/(l-i),this._offsetPrev=s*u,this._offsetNext=o*u}interpolate_(e,t,i,r){const s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,u=this._offsetPrev,d=this._offsetNext,f=this._weightPrev,p=this._weightNext,g=(i-t)/(r-t),v=g*g,m=v*g,h=-f*m+2*f*v-f*g,_=(1+f)*m+(-1.5-2*f)*v+(-.5+f)*g+1,x=(-1-p)*m+(1.5+p)*v+.5*g,M=p*m-p*v;for(let L=0;L!==a;++L)s[L]=h*o[u+L]+_*o[c+L]+x*o[l+L]+M*o[d+L];return s}}class yR extends ml{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e,t,i,r){const s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,u=(i-t)/(r-t),d=1-u;for(let f=0;f!==a;++f)s[f]=o[c+f]*d+o[l+f]*u;return s}}class SR extends ml{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e){return this.copySampleValue_(e-1)}}class ji{constructor(e,t,i,r){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=lc(t,this.TimeBufferType),this.values=lc(i,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){const t=e.constructor;let i;if(t.toJSON!==this.toJSON)i=t.toJSON(e);else{i={name:e.name,times:lc(e.times,Array),values:lc(e.values,Array)};const r=e.getInterpolation();r!==e.DefaultInterpolation&&(i.interpolation=r)}return i.type=e.ValueTypeName,i}InterpolantFactoryMethodDiscrete(e){return new SR(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new yR(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new vR(this.times,this.values,this.getValueSize(),e)}setInterpolation(e){let t;switch(e){case sl:t=this.InterpolantFactoryMethodDiscrete;break;case ol:t=this.InterpolantFactoryMethodLinear;break;case sd:t=this.InterpolantFactoryMethodSmooth;break}if(t===void 0){const i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return console.warn("THREE.KeyframeTrack:",i),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return sl;case this.InterpolantFactoryMethodLinear:return ol;case this.InterpolantFactoryMethodSmooth:return sd}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){const t=this.times;for(let i=0,r=t.length;i!==r;++i)t[i]+=e}return this}scale(e){if(e!==1){const t=this.times;for(let i=0,r=t.length;i!==r;++i)t[i]*=e}return this}trim(e,t){const i=this.times,r=i.length;let s=0,o=r-1;for(;s!==r&&i[s]<e;)++s;for(;o!==-1&&i[o]>t;)--o;if(++o,s!==0||o!==r){s>=o&&(o=Math.max(o,1),s=o-1);const a=this.getValueSize();this.times=i.slice(s,o),this.values=this.values.slice(s*a,o*a)}return this}validate(){let e=!0;const t=this.getValueSize();t-Math.floor(t)!==0&&(console.error("THREE.KeyframeTrack: Invalid value size in track.",this),e=!1);const i=this.times,r=this.values,s=i.length;s===0&&(console.error("THREE.KeyframeTrack: Track is empty.",this),e=!1);let o=null;for(let a=0;a!==s;a++){const l=i[a];if(typeof l=="number"&&isNaN(l)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,a,l),e=!1;break}if(o!==null&&o>l){console.error("THREE.KeyframeTrack: Out of order keys.",this,a,l,o),e=!1;break}o=l}if(r!==void 0&&_R(r))for(let a=0,l=r.length;a!==l;++a){const c=r[a];if(isNaN(c)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,a,c),e=!1;break}}return e}optimize(){const e=this.times.slice(),t=this.values.slice(),i=this.getValueSize(),r=this.getInterpolation()===sd,s=e.length-1;let o=1;for(let a=1;a<s;++a){let l=!1;const c=e[a],u=e[a+1];if(c!==u&&(a!==1||c!==e[0]))if(r)l=!0;else{const d=a*i,f=d-i,p=d+i;for(let g=0;g!==i;++g){const v=t[d+g];if(v!==t[f+g]||v!==t[p+g]){l=!0;break}}}if(l){if(a!==o){e[o]=e[a];const d=a*i,f=o*i;for(let p=0;p!==i;++p)t[f+p]=t[d+p]}++o}}if(s>0){e[o]=e[s];for(let a=s*i,l=o*i,c=0;c!==i;++c)t[l+c]=t[a+c];++o}return o!==e.length?(this.times=e.slice(0,o),this.values=t.slice(0,o*i)):(this.times=e,this.values=t),this}clone(){const e=this.times.slice(),t=this.values.slice(),i=this.constructor,r=new i(this.name,e,t);return r.createInterpolant=this.createInterpolant,r}}ji.prototype.TimeBufferType=Float32Array;ji.prototype.ValueBufferType=Float32Array;ji.prototype.DefaultInterpolation=ol;class Ko extends ji{constructor(e,t,i){super(e,t,i)}}Ko.prototype.ValueTypeName="bool";Ko.prototype.ValueBufferType=Array;Ko.prototype.DefaultInterpolation=sl;Ko.prototype.InterpolantFactoryMethodLinear=void 0;Ko.prototype.InterpolantFactoryMethodSmooth=void 0;class Jv extends ji{}Jv.prototype.ValueTypeName="color";class zo extends ji{}zo.prototype.ValueTypeName="number";class MR extends ml{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e,t,i,r){const s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=(i-t)/(r-t);let c=e*a;for(let u=c+a;c!==u;c+=4)Vi.slerpFlat(s,0,o,c-a,o,c,l);return s}}class Ho extends ji{InterpolantFactoryMethodLinear(e){return new MR(this.times,this.values,this.getValueSize(),e)}}Ho.prototype.ValueTypeName="quaternion";Ho.prototype.InterpolantFactoryMethodSmooth=void 0;class qo extends ji{constructor(e,t,i){super(e,t,i)}}qo.prototype.ValueTypeName="string";qo.prototype.ValueBufferType=Array;qo.prototype.DefaultInterpolation=sl;qo.prototype.InterpolantFactoryMethodLinear=void 0;qo.prototype.InterpolantFactoryMethodSmooth=void 0;class Vo extends ji{}Vo.prototype.ValueTypeName="vector";class ER{constructor(e="",t=-1,i=[],r=yE){this.name=e,this.tracks=i,this.duration=t,this.blendMode=r,this.uuid=Ti(),this.duration<0&&this.resetDuration()}static parse(e){const t=[],i=e.tracks,r=1/(e.fps||1);for(let o=0,a=i.length;o!==a;++o)t.push(TR(i[o]).scale(r));const s=new this(e.name,e.duration,t,e.blendMode);return s.uuid=e.uuid,s}static toJSON(e){const t=[],i=e.tracks,r={name:e.name,duration:e.duration,tracks:t,uuid:e.uuid,blendMode:e.blendMode};for(let s=0,o=i.length;s!==o;++s)t.push(ji.toJSON(i[s]));return r}static CreateFromMorphTargetSequence(e,t,i,r){const s=t.length,o=[];for(let a=0;a<s;a++){let l=[],c=[];l.push((a+s-1)%s,a,(a+1)%s),c.push(0,1,0);const u=xR(l);l=P0(l,1,u),c=P0(c,1,u),!r&&l[0]===0&&(l.push(s),c.push(c[0])),o.push(new zo(".morphTargetInfluences["+t[a].name+"]",l,c).scale(1/i))}return new this(e,-1,o)}static findByName(e,t){let i=e;if(!Array.isArray(e)){const r=e;i=r.geometry&&r.geometry.animations||r.animations}for(let r=0;r<i.length;r++)if(i[r].name===t)return i[r];return null}static CreateClipsFromMorphTargetSequences(e,t,i){const r={},s=/^([\w-]*?)([\d]+)$/;for(let a=0,l=e.length;a<l;a++){const c=e[a],u=c.name.match(s);if(u&&u.length>1){const d=u[1];let f=r[d];f||(r[d]=f=[]),f.push(c)}}const o=[];for(const a in r)o.push(this.CreateFromMorphTargetSequence(a,r[a],t,i));return o}static parseAnimation(e,t){if(!e)return console.error("THREE.AnimationClip: No animation in JSONLoader data."),null;const i=function(d,f,p,g,v){if(p.length!==0){const m=[],h=[];Zv(p,m,h,g),m.length!==0&&v.push(new d(f,m,h))}},r=[],s=e.name||"default",o=e.fps||30,a=e.blendMode;let l=e.length||-1;const c=e.hierarchy||[];for(let d=0;d<c.length;d++){const f=c[d].keys;if(!(!f||f.length===0))if(f[0].morphTargets){const p={};let g;for(g=0;g<f.length;g++)if(f[g].morphTargets)for(let v=0;v<f[g].morphTargets.length;v++)p[f[g].morphTargets[v]]=-1;for(const v in p){const m=[],h=[];for(let _=0;_!==f[g].morphTargets.length;++_){const x=f[g];m.push(x.time),h.push(x.morphTarget===v?1:0)}r.push(new zo(".morphTargetInfluence["+v+"]",m,h))}l=p.length*o}else{const p=".bones["+t[d].name+"]";i(Vo,p+".position",f,"pos",r),i(Ho,p+".quaternion",f,"rot",r),i(Vo,p+".scale",f,"scl",r)}}return r.length===0?null:new this(s,l,r,a)}resetDuration(){const e=this.tracks;let t=0;for(let i=0,r=e.length;i!==r;++i){const s=this.tracks[i];t=Math.max(t,s.times[s.times.length-1])}return this.duration=t,this}trim(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].trim(0,this.duration);return this}validate(){let e=!0;for(let t=0;t<this.tracks.length;t++)e=e&&this.tracks[t].validate();return e}optimize(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].optimize();return this}clone(){const e=[];for(let t=0;t<this.tracks.length;t++)e.push(this.tracks[t].clone());return new this.constructor(this.name,this.duration,e,this.blendMode)}toJSON(){return this.constructor.toJSON(this)}}function wR(n){switch(n.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return zo;case"vector":case"vector2":case"vector3":case"vector4":return Vo;case"color":return Jv;case"quaternion":return Ho;case"bool":case"boolean":return Ko;case"string":return qo}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+n)}function TR(n){if(n.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");const e=wR(n.type);if(n.times===void 0){const t=[],i=[];Zv(n.keys,t,i,"value"),n.times=t,n.values=i}return e.parse!==void 0?e.parse(n):new e(n.name,n.times,n.values,n.interpolation)}const Or={enabled:!1,files:{},add:function(n,e){this.enabled!==!1&&(this.files[n]=e)},get:function(n){if(this.enabled!==!1)return this.files[n]},remove:function(n){delete this.files[n]},clear:function(){this.files={}}};class bR{constructor(e,t,i){const r=this;let s=!1,o=0,a=0,l;const c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=i,this.itemStart=function(u){a++,s===!1&&r.onStart!==void 0&&r.onStart(u,o,a),s=!0},this.itemEnd=function(u){o++,r.onProgress!==void 0&&r.onProgress(u,o,a),o===a&&(s=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(u){r.onError!==void 0&&r.onError(u)},this.resolveURL=function(u){return l?l(u):u},this.setURLModifier=function(u){return l=u,this},this.addHandler=function(u,d){return c.push(u,d),this},this.removeHandler=function(u){const d=c.indexOf(u);return d!==-1&&c.splice(d,2),this},this.getHandler=function(u){for(let d=0,f=c.length;d<f;d+=2){const p=c[d],g=c[d+1];if(p.global&&(p.lastIndex=0),p.test(u))return g}return null}}}const AR=new bR;class Is{constructor(e){this.manager=e!==void 0?e:AR,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(e,t){const i=this;return new Promise(function(r,s){i.load(e,r,t,s)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}}Is.DEFAULT_MATERIAL_NAME="__DEFAULT";const Qi={};class RR extends Error{constructor(e,t){super(e),this.response=t}}class lu extends Is{constructor(e){super(e)}load(e,t,i,r){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const s=Or.get(e);if(s!==void 0)return this.manager.itemStart(e),setTimeout(()=>{t&&t(s),this.manager.itemEnd(e)},0),s;if(Qi[e]!==void 0){Qi[e].push({onLoad:t,onProgress:i,onError:r});return}Qi[e]=[],Qi[e].push({onLoad:t,onProgress:i,onError:r});const o=new Request(e,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin"}),a=this.mimeType,l=this.responseType;fetch(o).then(c=>{if(c.status===200||c.status===0){if(c.status===0&&console.warn("THREE.FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||c.body===void 0||c.body.getReader===void 0)return c;const u=Qi[e],d=c.body.getReader(),f=c.headers.get("X-File-Size")||c.headers.get("Content-Length"),p=f?parseInt(f):0,g=p!==0;let v=0;const m=new ReadableStream({start(h){_();function _(){d.read().then(({done:x,value:M})=>{if(x)h.close();else{v+=M.byteLength;const L=new ProgressEvent("progress",{lengthComputable:g,loaded:v,total:p});for(let A=0,T=u.length;A<T;A++){const I=u[A];I.onProgress&&I.onProgress(L)}h.enqueue(M),_()}},x=>{h.error(x)})}}});return new Response(m)}else throw new RR(`fetch for "${c.url}" responded with ${c.status}: ${c.statusText}`,c)}).then(c=>{switch(l){case"arraybuffer":return c.arrayBuffer();case"blob":return c.blob();case"document":return c.text().then(u=>new DOMParser().parseFromString(u,a));case"json":return c.json();default:if(a===void 0)return c.text();{const d=/charset="?([^;"\s]*)"?/i.exec(a),f=d&&d[1]?d[1].toLowerCase():void 0,p=new TextDecoder(f);return c.arrayBuffer().then(g=>p.decode(g))}}}).then(c=>{Or.add(e,c);const u=Qi[e];delete Qi[e];for(let d=0,f=u.length;d<f;d++){const p=u[d];p.onLoad&&p.onLoad(c)}}).catch(c=>{const u=Qi[e];if(u===void 0)throw this.manager.itemError(e),c;delete Qi[e];for(let d=0,f=u.length;d<f;d++){const p=u[d];p.onError&&p.onError(c)}this.manager.itemError(e)}).finally(()=>{this.manager.itemEnd(e)}),this.manager.itemStart(e)}setResponseType(e){return this.responseType=e,this}setMimeType(e){return this.mimeType=e,this}}class CR extends Is{constructor(e){super(e)}load(e,t,i,r){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const s=this,o=Or.get(e);if(o!==void 0)return s.manager.itemStart(e),setTimeout(function(){t&&t(o),s.manager.itemEnd(e)},0),o;const a=al("img");function l(){u(),Or.add(e,this),t&&t(this),s.manager.itemEnd(e)}function c(d){u(),r&&r(d),s.manager.itemError(e),s.manager.itemEnd(e)}function u(){a.removeEventListener("load",l,!1),a.removeEventListener("error",c,!1)}return a.addEventListener("load",l,!1),a.addEventListener("error",c,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(a.crossOrigin=this.crossOrigin),s.manager.itemStart(e),a.src=e,a}}class PR extends Is{constructor(e){super(e)}load(e,t,i,r){const s=new on,o=new CR(this.manager);return o.setCrossOrigin(this.crossOrigin),o.setPath(this.path),o.load(e,function(a){s.image=a,s.needsUpdate=!0,t!==void 0&&t(s)},i,r),s}}class Pu extends Bt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new Ke(e),this.intensity=t}dispose(){}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,this.groundColor!==void 0&&(t.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(t.object.distance=this.distance),this.angle!==void 0&&(t.object.angle=this.angle),this.decay!==void 0&&(t.object.decay=this.decay),this.penumbra!==void 0&&(t.object.penumbra=this.penumbra),this.shadow!==void 0&&(t.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(t.object.target=this.target.uuid),t}}const Od=new Ze,L0=new N,N0=new N;class Kp{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new He(512,512),this.map=null,this.mapPass=null,this.matrix=new Ze,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new zp,this._frameExtents=new He(1,1),this._viewportCount=1,this._viewports=[new yt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){const t=this.camera,i=this.matrix;L0.setFromMatrixPosition(e.matrixWorld),t.position.copy(L0),N0.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(N0),t.updateMatrixWorld(),Od.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Od),i.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),i.multiply(Od)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.mapSize.copy(e.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}class LR extends Kp{constructor(){super(new bn(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1}updateMatrices(e){const t=this.camera,i=Fo*2*e.angle*this.focus,r=this.mapSize.width/this.mapSize.height,s=e.distance||t.far;(i!==t.fov||r!==t.aspect||s!==t.far)&&(t.fov=i,t.aspect=r,t.far=s,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this}}class NR extends Pu{constructor(e,t,i=0,r=Math.PI/3,s=0,o=2){super(e,t),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(Bt.DEFAULT_UP),this.updateMatrix(),this.target=new Bt,this.distance=i,this.angle=r,this.penumbra=s,this.decay=o,this.map=null,this.shadow=new LR}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}}const D0=new Ze,xa=new N,Fd=new N;class DR extends Kp{constructor(){super(new bn(90,1,.5,500)),this.isPointLightShadow=!0,this._frameExtents=new He(4,2),this._viewportCount=6,this._viewports=[new yt(2,1,1,1),new yt(0,1,1,1),new yt(3,1,1,1),new yt(1,1,1,1),new yt(3,0,1,1),new yt(1,0,1,1)],this._cubeDirections=[new N(1,0,0),new N(-1,0,0),new N(0,0,1),new N(0,0,-1),new N(0,1,0),new N(0,-1,0)],this._cubeUps=[new N(0,1,0),new N(0,1,0),new N(0,1,0),new N(0,1,0),new N(0,0,1),new N(0,0,-1)]}updateMatrices(e,t=0){const i=this.camera,r=this.matrix,s=e.distance||i.far;s!==i.far&&(i.far=s,i.updateProjectionMatrix()),xa.setFromMatrixPosition(e.matrixWorld),i.position.copy(xa),Fd.copy(i.position),Fd.add(this._cubeDirections[t]),i.up.copy(this._cubeUps[t]),i.lookAt(Fd),i.updateMatrixWorld(),r.makeTranslation(-xa.x,-xa.y,-xa.z),D0.multiplyMatrices(i.projectionMatrix,i.matrixWorldInverse),this._frustum.setFromProjectionMatrix(D0)}}class IR extends Pu{constructor(e,t,i=0,r=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=i,this.decay=r,this.shadow=new DR}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}}class UR extends Kp{constructor(){super(new Hp(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class Ph extends Pu{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Bt.DEFAULT_UP),this.updateMatrix(),this.target=new Bt,this.shadow=new UR}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}}class kR extends Pu{constructor(e,t){super(e,t),this.isAmbientLight=!0,this.type="AmbientLight"}}class za{static decodeText(e){if(console.warn("THREE.LoaderUtils: decodeText() has been deprecated with r165 and will be removed with r175. Use TextDecoder instead."),typeof TextDecoder<"u")return new TextDecoder().decode(e);let t="";for(let i=0,r=e.length;i<r;i++)t+=String.fromCharCode(e[i]);try{return decodeURIComponent(escape(t))}catch{return t}}static extractUrlBase(e){const t=e.lastIndexOf("/");return t===-1?"./":e.slice(0,t+1)}static resolveURL(e,t){return typeof e!="string"||e===""?"":(/^https?:\/\//i.test(t)&&/^\//.test(e)&&(t=t.replace(/(^https?:\/\/[^\/]+).*/i,"$1")),/^(https?:)?\/\//i.test(e)||/^data:.*,.*$/i.test(e)||/^blob:.*$/i.test(e)?e:t+e)}}class OR extends Is{constructor(e){super(e),this.isImageBitmapLoader=!0,typeof createImageBitmap>"u"&&console.warn("THREE.ImageBitmapLoader: createImageBitmap() not supported."),typeof fetch>"u"&&console.warn("THREE.ImageBitmapLoader: fetch() not supported."),this.options={premultiplyAlpha:"none"}}setOptions(e){return this.options=e,this}load(e,t,i,r){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const s=this,o=Or.get(e);if(o!==void 0){if(s.manager.itemStart(e),o.then){o.then(c=>{t&&t(c),s.manager.itemEnd(e)}).catch(c=>{r&&r(c)});return}return setTimeout(function(){t&&t(o),s.manager.itemEnd(e)},0),o}const a={};a.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",a.headers=this.requestHeader;const l=fetch(e,a).then(function(c){return c.blob()}).then(function(c){return createImageBitmap(c,Object.assign(s.options,{colorSpaceConversion:"none"}))}).then(function(c){return Or.add(e,c),t&&t(c),s.manager.itemEnd(e),c}).catch(function(c){r&&r(c),Or.remove(e),s.manager.itemError(e),s.manager.itemEnd(e)});Or.add(e,l),s.manager.itemStart(e)}}const qp="\\[\\]\\.:\\/",FR=new RegExp("["+qp+"]","g"),$p="[^"+qp+"]",BR="[^"+qp.replace("\\.","")+"]",zR=/((?:WC+[\/:])*)/.source.replace("WC",$p),HR=/(WCOD+)?/.source.replace("WCOD",BR),VR=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",$p),GR=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",$p),WR=new RegExp("^"+zR+HR+VR+GR+"$"),jR=["material","materials","bones","map"];class XR{constructor(e,t,i){const r=i||Et.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,r)}getValue(e,t){this.bind();const i=this._targetGroup.nCachedObjects_,r=this._bindings[i];r!==void 0&&r.getValue(e,t)}setValue(e,t){const i=this._bindings;for(let r=this._targetGroup.nCachedObjects_,s=i.length;r!==s;++r)i[r].setValue(e,t)}bind(){const e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].bind()}unbind(){const e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].unbind()}}class Et{constructor(e,t,i){this.path=t,this.parsedPath=i||Et.parseTrackName(t),this.node=Et.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,i){return e&&e.isAnimationObjectGroup?new Et.Composite(e,t,i):new Et(e,t,i)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(FR,"")}static parseTrackName(e){const t=WR.exec(e);if(t===null)throw new Error("PropertyBinding: Cannot parse trackName: "+e);const i={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=i.nodeName&&i.nodeName.lastIndexOf(".");if(r!==void 0&&r!==-1){const s=i.nodeName.substring(r+1);jR.indexOf(s)!==-1&&(i.nodeName=i.nodeName.substring(0,r),i.objectName=s)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+e);return i}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){const i=e.skeleton.getBoneByName(t);if(i!==void 0)return i}if(e.children){const i=function(s){for(let o=0;o<s.length;o++){const a=s[o];if(a.name===t||a.uuid===t)return a;const l=i(a.children);if(l)return l}return null},r=i(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)e[t++]=i[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node;const t=this.parsedPath,i=t.objectName,r=t.propertyName;let s=t.propertyIndex;if(e||(e=Et.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){console.warn("THREE.PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let c=t.objectIndex;switch(i){case"materials":if(!e.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let u=0;u<e.length;u++)if(e[u].name===c){c=u;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){console.error("THREE.PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[i]===void 0){console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[i]}if(c!==void 0){if(e[c]===void 0){console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}const o=e[r];if(o===void 0){const c=t.nodeName;console.error("THREE.PropertyBinding: Trying to update property for track: "+c+"."+r+" but it wasn't found.",e);return}let a=this.Versioning.None;this.targetObject=e,e.needsUpdate!==void 0?a=this.Versioning.NeedsUpdate:e.matrixWorldNeedsUpdate!==void 0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(s!==void 0){if(r==="morphTargetInfluences"){if(!e.geometry){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[s]!==void 0&&(s=e.morphTargetDictionary[s])}l=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=s}else o.fromArray!==void 0&&o.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(l=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=r;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}}Et.Composite=XR;Et.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};Et.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};Et.prototype.GetterByBindingType=[Et.prototype._getValue_direct,Et.prototype._getValue_array,Et.prototype._getValue_arrayElement,Et.prototype._getValue_toArray];Et.prototype.SetterByBindingTypeAndVersioning=[[Et.prototype._setValue_direct,Et.prototype._setValue_direct_setNeedsUpdate,Et.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[Et.prototype._setValue_array,Et.prototype._setValue_array_setNeedsUpdate,Et.prototype._setValue_array_setMatrixWorldNeedsUpdate],[Et.prototype._setValue_arrayElement,Et.prototype._setValue_arrayElement_setNeedsUpdate,Et.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[Et.prototype._setValue_fromArray,Et.prototype._setValue_fromArray_setNeedsUpdate,Et.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];const I0=new Ze;class YR{constructor(e,t,i=0,r=1/0){this.ray=new Xo(e,t),this.near=i,this.far=r,this.camera=null,this.layers=new Bp,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,(t.near+t.far)/(t.near-t.far)).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):console.error("THREE.Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return I0.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(I0),this}intersectObject(e,t=!0,i=[]){return Lh(e,this,i,t),i.sort(U0),i}intersectObjects(e,t=!0,i=[]){for(let r=0,s=e.length;r<s;r++)Lh(e[r],this,i,t);return i.sort(U0),i}}function U0(n,e){return n.distance-e.distance}function Lh(n,e,t,i){let r=!0;if(n.layers.test(e.layers)&&n.raycast(e,t)===!1&&(r=!1),r===!0&&i===!0){const s=n.children;for(let o=0,a=s.length;o<a;o++)Lh(s[o],e,t,!0)}}class k0{constructor(e=1,t=0,i=0){return this.radius=e,this.phi=t,this.theta=i,this}set(e,t,i){return this.radius=e,this.phi=t,this.theta=i,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=Math.max(1e-6,Math.min(Math.PI-1e-6,this.phi)),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,i){return this.radius=Math.sqrt(e*e+t*t+i*i),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,i),this.phi=Math.acos(dn(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}}class Bd extends qv{constructor(e=10,t=10,i=4473924,r=8947848){i=new Ke(i),r=new Ke(r);const s=t/2,o=e/t,a=e/2,l=[],c=[];for(let f=0,p=0,g=-a;f<=t;f++,g+=o){l.push(-a,0,g,a,0,g),l.push(g,0,-a,g,0,a);const v=f===s?i:r;v.toArray(c,p),p+=3,v.toArray(c,p),p+=3,v.toArray(c,p),p+=3,v.toArray(c,p),p+=3}const u=new di;u.setAttribute("position",new bi(l,3)),u.setAttribute("color",new bi(c,3));const d=new jp({vertexColors:!0,toneMapped:!1});super(u,d),this.type="GridHelper"}dispose(){this.geometry.dispose(),this.material.dispose()}}class KR extends Ds{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(){}disconnect(){}dispose(){}update(){}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Cp}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Cp);function O0(n,e){if(e===SE)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),n;if(e===Th||e===Rv){let t=n.getIndex();if(t===null){const o=[],a=n.getAttribute("position");if(a!==void 0){for(let l=0;l<a.count;l++)o.push(l);n.setIndex(o),t=n.getIndex()}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),n}const i=t.count-2,r=[];if(e===Th)for(let o=1;o<=i;o++)r.push(t.getX(0)),r.push(t.getX(o)),r.push(t.getX(o+1));else for(let o=0;o<i;o++)o%2===0?(r.push(t.getX(o)),r.push(t.getX(o+1)),r.push(t.getX(o+2))):(r.push(t.getX(o+2)),r.push(t.getX(o+1)),r.push(t.getX(o)));r.length/3!==i&&console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");const s=n.clone();return s.setIndex(r),s.clearGroups(),s}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",e),n}class F0 extends Is{constructor(e){super(e),this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(t){return new QR(t)}),this.register(function(t){return new e2(t)}),this.register(function(t){return new c2(t)}),this.register(function(t){return new u2(t)}),this.register(function(t){return new d2(t)}),this.register(function(t){return new n2(t)}),this.register(function(t){return new i2(t)}),this.register(function(t){return new r2(t)}),this.register(function(t){return new s2(t)}),this.register(function(t){return new JR(t)}),this.register(function(t){return new o2(t)}),this.register(function(t){return new t2(t)}),this.register(function(t){return new l2(t)}),this.register(function(t){return new a2(t)}),this.register(function(t){return new $R(t)}),this.register(function(t){return new f2(t)}),this.register(function(t){return new h2(t)})}load(e,t,i,r){const s=this;let o;if(this.resourcePath!=="")o=this.resourcePath;else if(this.path!==""){const c=za.extractUrlBase(e);o=za.resolveURL(c,this.path)}else o=za.extractUrlBase(e);this.manager.itemStart(e);const a=function(c){r?r(c):console.error(c),s.manager.itemError(e),s.manager.itemEnd(e)},l=new lu(this.manager);l.setPath(this.path),l.setResponseType("arraybuffer"),l.setRequestHeader(this.requestHeader),l.setWithCredentials(this.withCredentials),l.load(e,function(c){try{s.parse(c,o,function(u){t(u),s.manager.itemEnd(e)},a)}catch(u){a(u)}},i,a)}setDRACOLoader(e){return this.dracoLoader=e,this}setKTX2Loader(e){return this.ktx2Loader=e,this}setMeshoptDecoder(e){return this.meshoptDecoder=e,this}register(e){return this.pluginCallbacks.indexOf(e)===-1&&this.pluginCallbacks.push(e),this}unregister(e){return this.pluginCallbacks.indexOf(e)!==-1&&this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(e),1),this}parse(e,t,i,r){let s;const o={},a={},l=new TextDecoder;if(typeof e=="string")s=JSON.parse(e);else if(e instanceof ArrayBuffer)if(l.decode(new Uint8Array(e,0,4))===Qv){try{o[ot.KHR_BINARY_GLTF]=new p2(e)}catch(d){r&&r(d);return}s=JSON.parse(o[ot.KHR_BINARY_GLTF].content)}else s=JSON.parse(l.decode(e));else s=e;if(s.asset===void 0||s.asset.version[0]<2){r&&r(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));return}const c=new A2(s,{path:t||this.resourcePath||"",crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});c.fileLoader.setRequestHeader(this.requestHeader);for(let u=0;u<this.pluginCallbacks.length;u++){const d=this.pluginCallbacks[u](c);d.name||console.error("THREE.GLTFLoader: Invalid plugin found: missing name"),a[d.name]=d,o[d.name]=!0}if(s.extensionsUsed)for(let u=0;u<s.extensionsUsed.length;++u){const d=s.extensionsUsed[u],f=s.extensionsRequired||[];switch(d){case ot.KHR_MATERIALS_UNLIT:o[d]=new ZR;break;case ot.KHR_DRACO_MESH_COMPRESSION:o[d]=new m2(s,this.dracoLoader);break;case ot.KHR_TEXTURE_TRANSFORM:o[d]=new g2;break;case ot.KHR_MESH_QUANTIZATION:o[d]=new _2;break;default:f.indexOf(d)>=0&&a[d]===void 0&&console.warn('THREE.GLTFLoader: Unknown extension "'+d+'".')}}c.setExtensions(o),c.setPlugins(a),c.parse(i,r)}parseAsync(e,t){const i=this;return new Promise(function(r,s){i.parse(e,t,r,s)})}}function qR(){let n={};return{get:function(e){return n[e]},add:function(e,t){n[e]=t},remove:function(e){delete n[e]},removeAll:function(){n={}}}}const ot={KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"};class $R{constructor(e){this.parser=e,this.name=ot.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}_markDefs(){const e=this.parser,t=this.parser.json.nodes||[];for(let i=0,r=t.length;i<r;i++){const s=t[i];s.extensions&&s.extensions[this.name]&&s.extensions[this.name].light!==void 0&&e._addNodeRef(this.cache,s.extensions[this.name].light)}}_loadLight(e){const t=this.parser,i="light:"+e;let r=t.cache.get(i);if(r)return r;const s=t.json,l=((s.extensions&&s.extensions[this.name]||{}).lights||[])[e];let c;const u=new Ke(16777215);l.color!==void 0&&u.setRGB(l.color[0],l.color[1],l.color[2],an);const d=l.range!==void 0?l.range:0;switch(l.type){case"directional":c=new Ph(u),c.target.position.set(0,0,-1),c.add(c.target);break;case"point":c=new IR(u),c.distance=d;break;case"spot":c=new NR(u),c.distance=d,l.spot=l.spot||{},l.spot.innerConeAngle=l.spot.innerConeAngle!==void 0?l.spot.innerConeAngle:0,l.spot.outerConeAngle=l.spot.outerConeAngle!==void 0?l.spot.outerConeAngle:Math.PI/4,c.angle=l.spot.outerConeAngle,c.penumbra=1-l.spot.innerConeAngle/l.spot.outerConeAngle,c.target.position.set(0,0,-1),c.add(c.target);break;default:throw new Error("THREE.GLTFLoader: Unexpected light type: "+l.type)}return c.position.set(0,0,0),c.decay=2,nr(c,l),l.intensity!==void 0&&(c.intensity=l.intensity),c.name=t.createUniqueName(l.name||"light_"+e),r=Promise.resolve(c),t.cache.add(i,r),r}getDependency(e,t){if(e==="light")return this._loadLight(t)}createNodeAttachment(e){const t=this,i=this.parser,s=i.json.nodes[e],a=(s.extensions&&s.extensions[this.name]||{}).light;return a===void 0?null:this._loadLight(a).then(function(l){return i._getNodeRef(t.cache,a,l)})}}class ZR{constructor(){this.name=ot.KHR_MATERIALS_UNLIT}getMaterialType(){return cr}extendParams(e,t,i){const r=[];e.color=new Ke(1,1,1),e.opacity=1;const s=t.pbrMetallicRoughness;if(s){if(Array.isArray(s.baseColorFactor)){const o=s.baseColorFactor;e.color.setRGB(o[0],o[1],o[2],an),e.opacity=o[3]}s.baseColorTexture!==void 0&&r.push(i.assignTexture(e,"map",s.baseColorTexture,Jt))}return Promise.all(r)}}class JR{constructor(e){this.parser=e,this.name=ot.KHR_MATERIALS_EMISSIVE_STRENGTH}extendMaterialParams(e,t){const r=this.parser.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=r.extensions[this.name].emissiveStrength;return s!==void 0&&(t.emissiveIntensity=s),Promise.resolve()}}class QR{constructor(e){this.parser=e,this.name=ot.KHR_MATERIALS_CLEARCOAT}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Wi}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[],o=r.extensions[this.name];if(o.clearcoatFactor!==void 0&&(t.clearcoat=o.clearcoatFactor),o.clearcoatTexture!==void 0&&s.push(i.assignTexture(t,"clearcoatMap",o.clearcoatTexture)),o.clearcoatRoughnessFactor!==void 0&&(t.clearcoatRoughness=o.clearcoatRoughnessFactor),o.clearcoatRoughnessTexture!==void 0&&s.push(i.assignTexture(t,"clearcoatRoughnessMap",o.clearcoatRoughnessTexture)),o.clearcoatNormalTexture!==void 0&&(s.push(i.assignTexture(t,"clearcoatNormalMap",o.clearcoatNormalTexture)),o.clearcoatNormalTexture.scale!==void 0)){const a=o.clearcoatNormalTexture.scale;t.clearcoatNormalScale=new He(a,a)}return Promise.all(s)}}class e2{constructor(e){this.parser=e,this.name=ot.KHR_MATERIALS_DISPERSION}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Wi}extendMaterialParams(e,t){const r=this.parser.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=r.extensions[this.name];return t.dispersion=s.dispersion!==void 0?s.dispersion:0,Promise.resolve()}}class t2{constructor(e){this.parser=e,this.name=ot.KHR_MATERIALS_IRIDESCENCE}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Wi}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[],o=r.extensions[this.name];return o.iridescenceFactor!==void 0&&(t.iridescence=o.iridescenceFactor),o.iridescenceTexture!==void 0&&s.push(i.assignTexture(t,"iridescenceMap",o.iridescenceTexture)),o.iridescenceIor!==void 0&&(t.iridescenceIOR=o.iridescenceIor),t.iridescenceThicknessRange===void 0&&(t.iridescenceThicknessRange=[100,400]),o.iridescenceThicknessMinimum!==void 0&&(t.iridescenceThicknessRange[0]=o.iridescenceThicknessMinimum),o.iridescenceThicknessMaximum!==void 0&&(t.iridescenceThicknessRange[1]=o.iridescenceThicknessMaximum),o.iridescenceThicknessTexture!==void 0&&s.push(i.assignTexture(t,"iridescenceThicknessMap",o.iridescenceThicknessTexture)),Promise.all(s)}}class n2{constructor(e){this.parser=e,this.name=ot.KHR_MATERIALS_SHEEN}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Wi}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[];t.sheenColor=new Ke(0,0,0),t.sheenRoughness=0,t.sheen=1;const o=r.extensions[this.name];if(o.sheenColorFactor!==void 0){const a=o.sheenColorFactor;t.sheenColor.setRGB(a[0],a[1],a[2],an)}return o.sheenRoughnessFactor!==void 0&&(t.sheenRoughness=o.sheenRoughnessFactor),o.sheenColorTexture!==void 0&&s.push(i.assignTexture(t,"sheenColorMap",o.sheenColorTexture,Jt)),o.sheenRoughnessTexture!==void 0&&s.push(i.assignTexture(t,"sheenRoughnessMap",o.sheenRoughnessTexture)),Promise.all(s)}}class i2{constructor(e){this.parser=e,this.name=ot.KHR_MATERIALS_TRANSMISSION}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Wi}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[],o=r.extensions[this.name];return o.transmissionFactor!==void 0&&(t.transmission=o.transmissionFactor),o.transmissionTexture!==void 0&&s.push(i.assignTexture(t,"transmissionMap",o.transmissionTexture)),Promise.all(s)}}class r2{constructor(e){this.parser=e,this.name=ot.KHR_MATERIALS_VOLUME}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Wi}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[],o=r.extensions[this.name];t.thickness=o.thicknessFactor!==void 0?o.thicknessFactor:0,o.thicknessTexture!==void 0&&s.push(i.assignTexture(t,"thicknessMap",o.thicknessTexture)),t.attenuationDistance=o.attenuationDistance||1/0;const a=o.attenuationColor||[1,1,1];return t.attenuationColor=new Ke().setRGB(a[0],a[1],a[2],an),Promise.all(s)}}class s2{constructor(e){this.parser=e,this.name=ot.KHR_MATERIALS_IOR}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Wi}extendMaterialParams(e,t){const r=this.parser.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=r.extensions[this.name];return t.ior=s.ior!==void 0?s.ior:1.5,Promise.resolve()}}class o2{constructor(e){this.parser=e,this.name=ot.KHR_MATERIALS_SPECULAR}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Wi}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[],o=r.extensions[this.name];t.specularIntensity=o.specularFactor!==void 0?o.specularFactor:1,o.specularTexture!==void 0&&s.push(i.assignTexture(t,"specularIntensityMap",o.specularTexture));const a=o.specularColorFactor||[1,1,1];return t.specularColor=new Ke().setRGB(a[0],a[1],a[2],an),o.specularColorTexture!==void 0&&s.push(i.assignTexture(t,"specularColorMap",o.specularColorTexture,Jt)),Promise.all(s)}}class a2{constructor(e){this.parser=e,this.name=ot.EXT_MATERIALS_BUMP}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Wi}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[],o=r.extensions[this.name];return t.bumpScale=o.bumpFactor!==void 0?o.bumpFactor:1,o.bumpTexture!==void 0&&s.push(i.assignTexture(t,"bumpMap",o.bumpTexture)),Promise.all(s)}}class l2{constructor(e){this.parser=e,this.name=ot.KHR_MATERIALS_ANISOTROPY}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Wi}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[],o=r.extensions[this.name];return o.anisotropyStrength!==void 0&&(t.anisotropy=o.anisotropyStrength),o.anisotropyRotation!==void 0&&(t.anisotropyRotation=o.anisotropyRotation),o.anisotropyTexture!==void 0&&s.push(i.assignTexture(t,"anisotropyMap",o.anisotropyTexture)),Promise.all(s)}}class c2{constructor(e){this.parser=e,this.name=ot.KHR_TEXTURE_BASISU}loadTexture(e){const t=this.parser,i=t.json,r=i.textures[e];if(!r.extensions||!r.extensions[this.name])return null;const s=r.extensions[this.name],o=t.options.ktx2Loader;if(!o){if(i.extensionsRequired&&i.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");return null}return t.loadTextureImage(e,s.source,o)}}class u2{constructor(e){this.parser=e,this.name=ot.EXT_TEXTURE_WEBP,this.isSupported=null}loadTexture(e){const t=this.name,i=this.parser,r=i.json,s=r.textures[e];if(!s.extensions||!s.extensions[t])return null;const o=s.extensions[t],a=r.images[o.source];let l=i.textureLoader;if(a.uri){const c=i.options.manager.getHandler(a.uri);c!==null&&(l=c)}return this.detectSupport().then(function(c){if(c)return i.loadTextureImage(e,o.source,l);if(r.extensionsRequired&&r.extensionsRequired.indexOf(t)>=0)throw new Error("THREE.GLTFLoader: WebP required by asset but unsupported.");return i.loadTexture(e)})}detectSupport(){return this.isSupported||(this.isSupported=new Promise(function(e){const t=new Image;t.src="data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",t.onload=t.onerror=function(){e(t.height===1)}})),this.isSupported}}class d2{constructor(e){this.parser=e,this.name=ot.EXT_TEXTURE_AVIF,this.isSupported=null}loadTexture(e){const t=this.name,i=this.parser,r=i.json,s=r.textures[e];if(!s.extensions||!s.extensions[t])return null;const o=s.extensions[t],a=r.images[o.source];let l=i.textureLoader;if(a.uri){const c=i.options.manager.getHandler(a.uri);c!==null&&(l=c)}return this.detectSupport().then(function(c){if(c)return i.loadTextureImage(e,o.source,l);if(r.extensionsRequired&&r.extensionsRequired.indexOf(t)>=0)throw new Error("THREE.GLTFLoader: AVIF required by asset but unsupported.");return i.loadTexture(e)})}detectSupport(){return this.isSupported||(this.isSupported=new Promise(function(e){const t=new Image;t.src="data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAABcAAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB9tZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI=",t.onload=t.onerror=function(){e(t.height===1)}})),this.isSupported}}class f2{constructor(e){this.name=ot.EXT_MESHOPT_COMPRESSION,this.parser=e}loadBufferView(e){const t=this.parser.json,i=t.bufferViews[e];if(i.extensions&&i.extensions[this.name]){const r=i.extensions[this.name],s=this.parser.getDependency("buffer",r.buffer),o=this.parser.options.meshoptDecoder;if(!o||!o.supported){if(t.extensionsRequired&&t.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");return null}return s.then(function(a){const l=r.byteOffset||0,c=r.byteLength||0,u=r.count,d=r.byteStride,f=new Uint8Array(a,l,c);return o.decodeGltfBufferAsync?o.decodeGltfBufferAsync(u,d,f,r.mode,r.filter).then(function(p){return p.buffer}):o.ready.then(function(){const p=new ArrayBuffer(u*d);return o.decodeGltfBuffer(new Uint8Array(p),u,d,f,r.mode,r.filter),p})})}else return null}}class h2{constructor(e){this.name=ot.EXT_MESH_GPU_INSTANCING,this.parser=e}createNodeMesh(e){const t=this.parser.json,i=t.nodes[e];if(!i.extensions||!i.extensions[this.name]||i.mesh===void 0)return null;const r=t.meshes[i.mesh];for(const c of r.primitives)if(c.mode!==ni.TRIANGLES&&c.mode!==ni.TRIANGLE_STRIP&&c.mode!==ni.TRIANGLE_FAN&&c.mode!==void 0)return null;const o=i.extensions[this.name].attributes,a=[],l={};for(const c in o)a.push(this.parser.getDependency("accessor",o[c]).then(u=>(l[c]=u,l[c])));return a.length<1?null:(a.push(this.parser.createNodeMesh(e)),Promise.all(a).then(c=>{const u=c.pop(),d=u.isGroup?u.children:[u],f=c[0].count,p=[];for(const g of d){const v=new Ze,m=new N,h=new Vi,_=new N(1,1,1),x=new pR(g.geometry,g.material,f);for(let M=0;M<f;M++)l.TRANSLATION&&m.fromBufferAttribute(l.TRANSLATION,M),l.ROTATION&&h.fromBufferAttribute(l.ROTATION,M),l.SCALE&&_.fromBufferAttribute(l.SCALE,M),x.setMatrixAt(M,v.compose(m,h,_));for(const M in l)if(M==="_COLOR_0"){const L=l[M];x.instanceColor=new Rh(L.array,L.itemSize,L.normalized)}else M!=="TRANSLATION"&&M!=="ROTATION"&&M!=="SCALE"&&g.geometry.setAttribute(M,l[M]);Bt.prototype.copy.call(x,g),this.parser.assignFinalMaterial(x),p.push(x)}return u.isGroup?(u.clear(),u.add(...p),u):p[0]}))}}const Qv="glTF",va=12,B0={JSON:1313821514,BIN:5130562};class p2{constructor(e){this.name=ot.KHR_BINARY_GLTF,this.content=null,this.body=null;const t=new DataView(e,0,va),i=new TextDecoder;if(this.header={magic:i.decode(new Uint8Array(e.slice(0,4))),version:t.getUint32(4,!0),length:t.getUint32(8,!0)},this.header.magic!==Qv)throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");if(this.header.version<2)throw new Error("THREE.GLTFLoader: Legacy binary file detected.");const r=this.header.length-va,s=new DataView(e,va);let o=0;for(;o<r;){const a=s.getUint32(o,!0);o+=4;const l=s.getUint32(o,!0);if(o+=4,l===B0.JSON){const c=new Uint8Array(e,va+o,a);this.content=i.decode(c)}else if(l===B0.BIN){const c=va+o;this.body=e.slice(c,c+a)}o+=a}if(this.content===null)throw new Error("THREE.GLTFLoader: JSON content not found.")}}class m2{constructor(e,t){if(!t)throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");this.name=ot.KHR_DRACO_MESH_COMPRESSION,this.json=e,this.dracoLoader=t,this.dracoLoader.preload()}decodePrimitive(e,t){const i=this.json,r=this.dracoLoader,s=e.extensions[this.name].bufferView,o=e.extensions[this.name].attributes,a={},l={},c={};for(const u in o){const d=Nh[u]||u.toLowerCase();a[d]=o[u]}for(const u in e.attributes){const d=Nh[u]||u.toLowerCase();if(o[u]!==void 0){const f=i.accessors[e.attributes[u]],p=wo[f.componentType];c[d]=p.name,l[d]=f.normalized===!0}}return t.getDependency("bufferView",s).then(function(u){return new Promise(function(d,f){r.decodeDracoFile(u,function(p){for(const g in p.attributes){const v=p.attributes[g],m=l[g];m!==void 0&&(v.normalized=m)}d(p)},a,c,an,f)})})}}class g2{constructor(){this.name=ot.KHR_TEXTURE_TRANSFORM}extendTexture(e,t){return(t.texCoord===void 0||t.texCoord===e.channel)&&t.offset===void 0&&t.rotation===void 0&&t.scale===void 0||(e=e.clone(),t.texCoord!==void 0&&(e.channel=t.texCoord),t.offset!==void 0&&e.offset.fromArray(t.offset),t.rotation!==void 0&&(e.rotation=t.rotation),t.scale!==void 0&&e.repeat.fromArray(t.scale),e.needsUpdate=!0),e}}class _2{constructor(){this.name=ot.KHR_MESH_QUANTIZATION}}class ey extends ml{constructor(e,t,i,r){super(e,t,i,r)}copySampleValue_(e){const t=this.resultBuffer,i=this.sampleValues,r=this.valueSize,s=e*r*3+r;for(let o=0;o!==r;o++)t[o]=i[s+o];return t}interpolate_(e,t,i,r){const s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=a*2,c=a*3,u=r-t,d=(i-t)/u,f=d*d,p=f*d,g=e*c,v=g-c,m=-2*p+3*f,h=p-f,_=1-m,x=h-f+d;for(let M=0;M!==a;M++){const L=o[v+M+a],A=o[v+M+l]*u,T=o[g+M+a],I=o[g+M]*u;s[M]=_*L+x*A+m*T+h*I}return s}}const x2=new Vi;class v2 extends ey{interpolate_(e,t,i,r){const s=super.interpolate_(e,t,i,r);return x2.fromArray(s).normalize().toArray(s),s}}const ni={POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6},wo={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},z0={9728:An,9729:kn,9984:xv,9985:Ec,9986:Aa,9987:Oi},H0={33071:kr,33648:tu,10497:Uo},zd={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},Nh={POSITION:"position",NORMAL:"normal",TANGENT:"tangent",TEXCOORD_0:"uv",TEXCOORD_1:"uv1",TEXCOORD_2:"uv2",TEXCOORD_3:"uv3",COLOR_0:"color",WEIGHTS_0:"skinWeight",JOINTS_0:"skinIndex"},Rr={scale:"scale",translation:"position",rotation:"quaternion",weights:"morphTargetInfluences"},y2={CUBICSPLINE:void 0,LINEAR:ol,STEP:sl},Hd={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};function S2(n){return n.DefaultMaterial===void 0&&(n.DefaultMaterial=new Yp({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:Hi})),n.DefaultMaterial}function cs(n,e,t){for(const i in t.extensions)n[i]===void 0&&(e.userData.gltfExtensions=e.userData.gltfExtensions||{},e.userData.gltfExtensions[i]=t.extensions[i])}function nr(n,e){e.extras!==void 0&&(typeof e.extras=="object"?Object.assign(n.userData,e.extras):console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, "+e.extras))}function M2(n,e,t){let i=!1,r=!1,s=!1;for(let c=0,u=e.length;c<u;c++){const d=e[c];if(d.POSITION!==void 0&&(i=!0),d.NORMAL!==void 0&&(r=!0),d.COLOR_0!==void 0&&(s=!0),i&&r&&s)break}if(!i&&!r&&!s)return Promise.resolve(n);const o=[],a=[],l=[];for(let c=0,u=e.length;c<u;c++){const d=e[c];if(i){const f=d.POSITION!==void 0?t.getDependency("accessor",d.POSITION):n.attributes.position;o.push(f)}if(r){const f=d.NORMAL!==void 0?t.getDependency("accessor",d.NORMAL):n.attributes.normal;a.push(f)}if(s){const f=d.COLOR_0!==void 0?t.getDependency("accessor",d.COLOR_0):n.attributes.color;l.push(f)}}return Promise.all([Promise.all(o),Promise.all(a),Promise.all(l)]).then(function(c){const u=c[0],d=c[1],f=c[2];return i&&(n.morphAttributes.position=u),r&&(n.morphAttributes.normal=d),s&&(n.morphAttributes.color=f),n.morphTargetsRelative=!0,n})}function E2(n,e){if(n.updateMorphTargets(),e.weights!==void 0)for(let t=0,i=e.weights.length;t<i;t++)n.morphTargetInfluences[t]=e.weights[t];if(e.extras&&Array.isArray(e.extras.targetNames)){const t=e.extras.targetNames;if(n.morphTargetInfluences.length===t.length){n.morphTargetDictionary={};for(let i=0,r=t.length;i<r;i++)n.morphTargetDictionary[t[i]]=i}else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.")}}function w2(n){let e;const t=n.extensions&&n.extensions[ot.KHR_DRACO_MESH_COMPRESSION];if(t?e="draco:"+t.bufferView+":"+t.indices+":"+Vd(t.attributes):e=n.indices+":"+Vd(n.attributes)+":"+n.mode,n.targets!==void 0)for(let i=0,r=n.targets.length;i<r;i++)e+=":"+Vd(n.targets[i]);return e}function Vd(n){let e="";const t=Object.keys(n).sort();for(let i=0,r=t.length;i<r;i++)e+=t[i]+":"+n[t[i]]+";";return e}function Dh(n){switch(n){case Int8Array:return 1/127;case Uint8Array:return 1/255;case Int16Array:return 1/32767;case Uint16Array:return 1/65535;default:throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.")}}function T2(n){return n.search(/\.jpe?g($|\?)/i)>0||n.search(/^data\:image\/jpeg/)===0?"image/jpeg":n.search(/\.webp($|\?)/i)>0||n.search(/^data\:image\/webp/)===0?"image/webp":"image/png"}const b2=new Ze;class A2{constructor(e={},t={}){this.json=e,this.extensions={},this.plugins={},this.options=t,this.cache=new qR,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let i=!1,r=-1,s=!1,o=-1;if(typeof navigator<"u"){const a=navigator.userAgent;i=/^((?!chrome|android).)*safari/i.test(a)===!0;const l=a.match(/Version\/(\d+)/);r=i&&l?parseInt(l[1],10):-1,s=a.indexOf("Firefox")>-1,o=s?a.match(/Firefox\/([0-9]+)\./)[1]:-1}typeof createImageBitmap>"u"||i&&r<17||s&&o<98?this.textureLoader=new PR(this.options.manager):this.textureLoader=new OR(this.options.manager),this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new lu(this.options.manager),this.fileLoader.setResponseType("arraybuffer"),this.options.crossOrigin==="use-credentials"&&this.fileLoader.setWithCredentials(!0)}setExtensions(e){this.extensions=e}setPlugins(e){this.plugins=e}parse(e,t){const i=this,r=this.json,s=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(o){return o._markDefs&&o._markDefs()}),Promise.all(this._invokeAll(function(o){return o.beforeRoot&&o.beforeRoot()})).then(function(){return Promise.all([i.getDependencies("scene"),i.getDependencies("animation"),i.getDependencies("camera")])}).then(function(o){const a={scene:o[0][r.scene||0],scenes:o[0],animations:o[1],cameras:o[2],asset:r.asset,parser:i,userData:{}};return cs(s,a,r),nr(a,r),Promise.all(i._invokeAll(function(l){return l.afterRoot&&l.afterRoot(a)})).then(function(){for(const l of a.scenes)l.updateMatrixWorld();e(a)})}).catch(t)}_markDefs(){const e=this.json.nodes||[],t=this.json.skins||[],i=this.json.meshes||[];for(let r=0,s=t.length;r<s;r++){const o=t[r].joints;for(let a=0,l=o.length;a<l;a++)e[o[a]].isBone=!0}for(let r=0,s=e.length;r<s;r++){const o=e[r];o.mesh!==void 0&&(this._addNodeRef(this.meshCache,o.mesh),o.skin!==void 0&&(i[o.mesh].isSkinnedMesh=!0)),o.camera!==void 0&&this._addNodeRef(this.cameraCache,o.camera)}}_addNodeRef(e,t){t!==void 0&&(e.refs[t]===void 0&&(e.refs[t]=e.uses[t]=0),e.refs[t]++)}_getNodeRef(e,t,i){if(e.refs[t]<=1)return i;const r=i.clone(),s=(o,a)=>{const l=this.associations.get(o);l!=null&&this.associations.set(a,l);for(const[c,u]of o.children.entries())s(u,a.children[c])};return s(i,r),r.name+="_instance_"+e.uses[t]++,r}_invokeOne(e){const t=Object.values(this.plugins);t.push(this);for(let i=0;i<t.length;i++){const r=e(t[i]);if(r)return r}return null}_invokeAll(e){const t=Object.values(this.plugins);t.unshift(this);const i=[];for(let r=0;r<t.length;r++){const s=e(t[r]);s&&i.push(s)}return i}getDependency(e,t){const i=e+":"+t;let r=this.cache.get(i);if(!r){switch(e){case"scene":r=this.loadScene(t);break;case"node":r=this._invokeOne(function(s){return s.loadNode&&s.loadNode(t)});break;case"mesh":r=this._invokeOne(function(s){return s.loadMesh&&s.loadMesh(t)});break;case"accessor":r=this.loadAccessor(t);break;case"bufferView":r=this._invokeOne(function(s){return s.loadBufferView&&s.loadBufferView(t)});break;case"buffer":r=this.loadBuffer(t);break;case"material":r=this._invokeOne(function(s){return s.loadMaterial&&s.loadMaterial(t)});break;case"texture":r=this._invokeOne(function(s){return s.loadTexture&&s.loadTexture(t)});break;case"skin":r=this.loadSkin(t);break;case"animation":r=this._invokeOne(function(s){return s.loadAnimation&&s.loadAnimation(t)});break;case"camera":r=this.loadCamera(t);break;default:if(r=this._invokeOne(function(s){return s!=this&&s.getDependency&&s.getDependency(e,t)}),!r)throw new Error("Unknown type: "+e);break}this.cache.add(i,r)}return r}getDependencies(e){let t=this.cache.get(e);if(!t){const i=this,r=this.json[e+(e==="mesh"?"es":"s")]||[];t=Promise.all(r.map(function(s,o){return i.getDependency(e,o)})),this.cache.add(e,t)}return t}loadBuffer(e){const t=this.json.buffers[e],i=this.fileLoader;if(t.type&&t.type!=="arraybuffer")throw new Error("THREE.GLTFLoader: "+t.type+" buffer type is not supported.");if(t.uri===void 0&&e===0)return Promise.resolve(this.extensions[ot.KHR_BINARY_GLTF].body);const r=this.options;return new Promise(function(s,o){i.load(za.resolveURL(t.uri,r.path),s,void 0,function(){o(new Error('THREE.GLTFLoader: Failed to load buffer "'+t.uri+'".'))})})}loadBufferView(e){const t=this.json.bufferViews[e];return this.getDependency("buffer",t.buffer).then(function(i){const r=t.byteLength||0,s=t.byteOffset||0;return i.slice(s,s+r)})}loadAccessor(e){const t=this,i=this.json,r=this.json.accessors[e];if(r.bufferView===void 0&&r.sparse===void 0){const o=zd[r.type],a=wo[r.componentType],l=r.normalized===!0,c=new a(r.count*o);return Promise.resolve(new hn(c,o,l))}const s=[];return r.bufferView!==void 0?s.push(this.getDependency("bufferView",r.bufferView)):s.push(null),r.sparse!==void 0&&(s.push(this.getDependency("bufferView",r.sparse.indices.bufferView)),s.push(this.getDependency("bufferView",r.sparse.values.bufferView))),Promise.all(s).then(function(o){const a=o[0],l=zd[r.type],c=wo[r.componentType],u=c.BYTES_PER_ELEMENT,d=u*l,f=r.byteOffset||0,p=r.bufferView!==void 0?i.bufferViews[r.bufferView].byteStride:void 0,g=r.normalized===!0;let v,m;if(p&&p!==d){const h=Math.floor(f/p),_="InterleavedBuffer:"+r.bufferView+":"+r.componentType+":"+h+":"+r.count;let x=t.cache.get(_);x||(v=new c(a,h*p,r.count*p/u),x=new cR(v,p/u),t.cache.add(_,x)),m=new Gp(x,l,f%p/u,g)}else a===null?v=new c(r.count*l):v=new c(a,f,r.count*l),m=new hn(v,l,g);if(r.sparse!==void 0){const h=zd.SCALAR,_=wo[r.sparse.indices.componentType],x=r.sparse.indices.byteOffset||0,M=r.sparse.values.byteOffset||0,L=new _(o[1],x,r.sparse.count*h),A=new c(o[2],M,r.sparse.count*l);a!==null&&(m=new hn(m.array.slice(),m.itemSize,m.normalized)),m.normalized=!1;for(let T=0,I=L.length;T<I;T++){const K=L[T];if(m.setX(K,A[T*l]),l>=2&&m.setY(K,A[T*l+1]),l>=3&&m.setZ(K,A[T*l+2]),l>=4&&m.setW(K,A[T*l+3]),l>=5)throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.")}m.normalized=g}return m})}loadTexture(e){const t=this.json,i=this.options,s=t.textures[e].source,o=t.images[s];let a=this.textureLoader;if(o.uri){const l=i.manager.getHandler(o.uri);l!==null&&(a=l)}return this.loadTextureImage(e,s,a)}loadTextureImage(e,t,i){const r=this,s=this.json,o=s.textures[e],a=s.images[t],l=(a.uri||a.bufferView)+":"+o.sampler;if(this.textureCache[l])return this.textureCache[l];const c=this.loadImageSource(t,i).then(function(u){u.flipY=!1,u.name=o.name||a.name||"",u.name===""&&typeof a.uri=="string"&&a.uri.startsWith("data:image/")===!1&&(u.name=a.uri);const f=(s.samplers||{})[o.sampler]||{};return u.magFilter=z0[f.magFilter]||kn,u.minFilter=z0[f.minFilter]||Oi,u.wrapS=H0[f.wrapS]||Uo,u.wrapT=H0[f.wrapT]||Uo,r.associations.set(u,{textures:e}),u}).catch(function(){return null});return this.textureCache[l]=c,c}loadImageSource(e,t){const i=this,r=this.json,s=this.options;if(this.sourceCache[e]!==void 0)return this.sourceCache[e].then(d=>d.clone());const o=r.images[e],a=self.URL||self.webkitURL;let l=o.uri||"",c=!1;if(o.bufferView!==void 0)l=i.getDependency("bufferView",o.bufferView).then(function(d){c=!0;const f=new Blob([d],{type:o.mimeType});return l=a.createObjectURL(f),l});else if(o.uri===void 0)throw new Error("THREE.GLTFLoader: Image "+e+" is missing URI and bufferView");const u=Promise.resolve(l).then(function(d){return new Promise(function(f,p){let g=f;t.isImageBitmapLoader===!0&&(g=function(v){const m=new on(v);m.needsUpdate=!0,f(m)}),t.load(za.resolveURL(d,s.path),g,void 0,p)})}).then(function(d){return c===!0&&a.revokeObjectURL(l),nr(d,o),d.userData.mimeType=o.mimeType||T2(o.uri),d}).catch(function(d){throw console.error("THREE.GLTFLoader: Couldn't load texture",l),d});return this.sourceCache[e]=u,u}assignTexture(e,t,i,r){const s=this;return this.getDependency("texture",i.index).then(function(o){if(!o)return null;if(i.texCoord!==void 0&&i.texCoord>0&&(o=o.clone(),o.channel=i.texCoord),s.extensions[ot.KHR_TEXTURE_TRANSFORM]){const a=i.extensions!==void 0?i.extensions[ot.KHR_TEXTURE_TRANSFORM]:void 0;if(a){const l=s.associations.get(o);o=s.extensions[ot.KHR_TEXTURE_TRANSFORM].extendTexture(o,a),s.associations.set(o,l)}}return r!==void 0&&(o.colorSpace=r),e[t]=o,o})}assignFinalMaterial(e){const t=e.geometry;let i=e.material;const r=t.attributes.tangent===void 0,s=t.attributes.color!==void 0,o=t.attributes.normal===void 0;if(e.isPoints){const a="PointsMaterial:"+i.uuid;let l=this.cache.get(a);l||(l=new $v,zi.prototype.copy.call(l,i),l.color.copy(i.color),l.map=i.map,l.sizeAttenuation=!1,this.cache.add(a,l)),i=l}else if(e.isLine){const a="LineBasicMaterial:"+i.uuid;let l=this.cache.get(a);l||(l=new jp,zi.prototype.copy.call(l,i),l.color.copy(i.color),l.map=i.map,this.cache.add(a,l)),i=l}if(r||s||o){let a="ClonedMaterial:"+i.uuid+":";r&&(a+="derivative-tangents:"),s&&(a+="vertex-colors:"),o&&(a+="flat-shading:");let l=this.cache.get(a);l||(l=i.clone(),s&&(l.vertexColors=!0),o&&(l.flatShading=!0),r&&(l.normalScale&&(l.normalScale.y*=-1),l.clearcoatNormalScale&&(l.clearcoatNormalScale.y*=-1)),this.cache.add(a,l),this.associations.set(l,this.associations.get(i))),i=l}e.material=i}getMaterialType(){return Yp}loadMaterial(e){const t=this,i=this.json,r=this.extensions,s=i.materials[e];let o;const a={},l=s.extensions||{},c=[];if(l[ot.KHR_MATERIALS_UNLIT]){const d=r[ot.KHR_MATERIALS_UNLIT];o=d.getMaterialType(),c.push(d.extendParams(a,s,t))}else{const d=s.pbrMetallicRoughness||{};if(a.color=new Ke(1,1,1),a.opacity=1,Array.isArray(d.baseColorFactor)){const f=d.baseColorFactor;a.color.setRGB(f[0],f[1],f[2],an),a.opacity=f[3]}d.baseColorTexture!==void 0&&c.push(t.assignTexture(a,"map",d.baseColorTexture,Jt)),a.metalness=d.metallicFactor!==void 0?d.metallicFactor:1,a.roughness=d.roughnessFactor!==void 0?d.roughnessFactor:1,d.metallicRoughnessTexture!==void 0&&(c.push(t.assignTexture(a,"metalnessMap",d.metallicRoughnessTexture)),c.push(t.assignTexture(a,"roughnessMap",d.metallicRoughnessTexture))),o=this._invokeOne(function(f){return f.getMaterialType&&f.getMaterialType(e)}),c.push(Promise.all(this._invokeAll(function(f){return f.extendMaterialParams&&f.extendMaterialParams(e,a)})))}s.doubleSided===!0&&(a.side=ki);const u=s.alphaMode||Hd.OPAQUE;if(u===Hd.BLEND?(a.transparent=!0,a.depthWrite=!1):(a.transparent=!1,u===Hd.MASK&&(a.alphaTest=s.alphaCutoff!==void 0?s.alphaCutoff:.5)),s.normalTexture!==void 0&&o!==cr&&(c.push(t.assignTexture(a,"normalMap",s.normalTexture)),a.normalScale=new He(1,1),s.normalTexture.scale!==void 0)){const d=s.normalTexture.scale;a.normalScale.set(d,d)}if(s.occlusionTexture!==void 0&&o!==cr&&(c.push(t.assignTexture(a,"aoMap",s.occlusionTexture)),s.occlusionTexture.strength!==void 0&&(a.aoMapIntensity=s.occlusionTexture.strength)),s.emissiveFactor!==void 0&&o!==cr){const d=s.emissiveFactor;a.emissive=new Ke().setRGB(d[0],d[1],d[2],an)}return s.emissiveTexture!==void 0&&o!==cr&&c.push(t.assignTexture(a,"emissiveMap",s.emissiveTexture,Jt)),Promise.all(c).then(function(){const d=new o(a);return s.name&&(d.name=s.name),nr(d,s),t.associations.set(d,{materials:e}),s.extensions&&cs(r,d,s),d})}createUniqueName(e){const t=Et.sanitizeNodeName(e||"");return t in this.nodeNamesUsed?t+"_"+ ++this.nodeNamesUsed[t]:(this.nodeNamesUsed[t]=0,t)}loadGeometries(e){const t=this,i=this.extensions,r=this.primitiveCache;function s(a){return i[ot.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(a,t).then(function(l){return V0(l,a,t)})}const o=[];for(let a=0,l=e.length;a<l;a++){const c=e[a],u=w2(c),d=r[u];if(d)o.push(d.promise);else{let f;c.extensions&&c.extensions[ot.KHR_DRACO_MESH_COMPRESSION]?f=s(c):f=V0(new di,c,t),r[u]={primitive:c,promise:f},o.push(f)}}return Promise.all(o)}loadMesh(e){const t=this,i=this.json,r=this.extensions,s=i.meshes[e],o=s.primitives,a=[];for(let l=0,c=o.length;l<c;l++){const u=o[l].material===void 0?S2(this.cache):this.getDependency("material",o[l].material);a.push(u)}return a.push(t.loadGeometries(o)),Promise.all(a).then(function(l){const c=l.slice(0,l.length-1),u=l[l.length-1],d=[];for(let p=0,g=u.length;p<g;p++){const v=u[p],m=o[p];let h;const _=c[p];if(m.mode===ni.TRIANGLES||m.mode===ni.TRIANGLE_STRIP||m.mode===ni.TRIANGLE_FAN||m.mode===void 0)h=s.isSkinnedMesh===!0?new dR(v,_):new Yn(v,_),h.isSkinnedMesh===!0&&h.normalizeSkinWeights(),m.mode===ni.TRIANGLE_STRIP?h.geometry=O0(h.geometry,Rv):m.mode===ni.TRIANGLE_FAN&&(h.geometry=O0(h.geometry,Th));else if(m.mode===ni.LINES)h=new qv(v,_);else if(m.mode===ni.LINE_STRIP)h=new Xp(v,_);else if(m.mode===ni.LINE_LOOP)h=new mR(v,_);else if(m.mode===ni.POINTS)h=new gR(v,_);else throw new Error("THREE.GLTFLoader: Primitive mode unsupported: "+m.mode);Object.keys(h.geometry.morphAttributes).length>0&&E2(h,s),h.name=t.createUniqueName(s.name||"mesh_"+e),nr(h,s),m.extensions&&cs(r,h,m),t.assignFinalMaterial(h),d.push(h)}for(let p=0,g=d.length;p<g;p++)t.associations.set(d[p],{meshes:e,primitives:p});if(d.length===1)return s.extensions&&cs(r,d[0],s),d[0];const f=new Ss;s.extensions&&cs(r,f,s),t.associations.set(f,{meshes:e});for(let p=0,g=d.length;p<g;p++)f.add(d[p]);return f})}loadCamera(e){let t;const i=this.json.cameras[e],r=i[i.type];if(!r){console.warn("THREE.GLTFLoader: Missing camera parameters.");return}return i.type==="perspective"?t=new bn(Lv.radToDeg(r.yfov),r.aspectRatio||1,r.znear||1,r.zfar||2e6):i.type==="orthographic"&&(t=new Hp(-r.xmag,r.xmag,r.ymag,-r.ymag,r.znear,r.zfar)),i.name&&(t.name=this.createUniqueName(i.name)),nr(t,i),Promise.resolve(t)}loadSkin(e){const t=this.json.skins[e],i=[];for(let r=0,s=t.joints.length;r<s;r++)i.push(this._loadNodeShallow(t.joints[r]));return t.inverseBindMatrices!==void 0?i.push(this.getDependency("accessor",t.inverseBindMatrices)):i.push(null),Promise.all(i).then(function(r){const s=r.pop(),o=r,a=[],l=[];for(let c=0,u=o.length;c<u;c++){const d=o[c];if(d){a.push(d);const f=new Ze;s!==null&&f.fromArray(s.array,c*16),l.push(f)}else console.warn('THREE.GLTFLoader: Joint "%s" could not be found.',t.joints[c])}return new Wp(a,l)})}loadAnimation(e){const t=this.json,i=this,r=t.animations[e],s=r.name?r.name:"animation_"+e,o=[],a=[],l=[],c=[],u=[];for(let d=0,f=r.channels.length;d<f;d++){const p=r.channels[d],g=r.samplers[p.sampler],v=p.target,m=v.node,h=r.parameters!==void 0?r.parameters[g.input]:g.input,_=r.parameters!==void 0?r.parameters[g.output]:g.output;v.node!==void 0&&(o.push(this.getDependency("node",m)),a.push(this.getDependency("accessor",h)),l.push(this.getDependency("accessor",_)),c.push(g),u.push(v))}return Promise.all([Promise.all(o),Promise.all(a),Promise.all(l),Promise.all(c),Promise.all(u)]).then(function(d){const f=d[0],p=d[1],g=d[2],v=d[3],m=d[4],h=[];for(let _=0,x=f.length;_<x;_++){const M=f[_],L=p[_],A=g[_],T=v[_],I=m[_];if(M===void 0)continue;M.updateMatrix&&M.updateMatrix();const K=i._createAnimationTracks(M,L,A,T,I);if(K)for(let y=0;y<K.length;y++)h.push(K[y])}return new ER(s,void 0,h)})}createNodeMesh(e){const t=this.json,i=this,r=t.nodes[e];return r.mesh===void 0?null:i.getDependency("mesh",r.mesh).then(function(s){const o=i._getNodeRef(i.meshCache,r.mesh,s);return r.weights!==void 0&&o.traverse(function(a){if(a.isMesh)for(let l=0,c=r.weights.length;l<c;l++)a.morphTargetInfluences[l]=r.weights[l]}),o})}loadNode(e){const t=this.json,i=this,r=t.nodes[e],s=i._loadNodeShallow(e),o=[],a=r.children||[];for(let c=0,u=a.length;c<u;c++)o.push(i.getDependency("node",a[c]));const l=r.skin===void 0?Promise.resolve(null):i.getDependency("skin",r.skin);return Promise.all([s,Promise.all(o),l]).then(function(c){const u=c[0],d=c[1],f=c[2];f!==null&&u.traverse(function(p){p.isSkinnedMesh&&p.bind(f,b2)});for(let p=0,g=d.length;p<g;p++)u.add(d[p]);return u})}_loadNodeShallow(e){const t=this.json,i=this.extensions,r=this;if(this.nodeCache[e]!==void 0)return this.nodeCache[e];const s=t.nodes[e],o=s.name?r.createUniqueName(s.name):"",a=[],l=r._invokeOne(function(c){return c.createNodeMesh&&c.createNodeMesh(e)});return l&&a.push(l),s.camera!==void 0&&a.push(r.getDependency("camera",s.camera).then(function(c){return r._getNodeRef(r.cameraCache,s.camera,c)})),r._invokeAll(function(c){return c.createNodeAttachment&&c.createNodeAttachment(e)}).forEach(function(c){a.push(c)}),this.nodeCache[e]=Promise.all(a).then(function(c){let u;if(s.isBone===!0?u=new Yv:c.length>1?u=new Ss:c.length===1?u=c[0]:u=new Bt,u!==c[0])for(let d=0,f=c.length;d<f;d++)u.add(c[d]);if(s.name&&(u.userData.name=s.name,u.name=o),nr(u,s),s.extensions&&cs(i,u,s),s.matrix!==void 0){const d=new Ze;d.fromArray(s.matrix),u.applyMatrix4(d)}else s.translation!==void 0&&u.position.fromArray(s.translation),s.rotation!==void 0&&u.quaternion.fromArray(s.rotation),s.scale!==void 0&&u.scale.fromArray(s.scale);return r.associations.has(u)||r.associations.set(u,{}),r.associations.get(u).nodes=e,u}),this.nodeCache[e]}loadScene(e){const t=this.extensions,i=this.json.scenes[e],r=this,s=new Ss;i.name&&(s.name=r.createUniqueName(i.name)),nr(s,i),i.extensions&&cs(t,s,i);const o=i.nodes||[],a=[];for(let l=0,c=o.length;l<c;l++)a.push(r.getDependency("node",o[l]));return Promise.all(a).then(function(l){for(let u=0,d=l.length;u<d;u++)s.add(l[u]);const c=u=>{const d=new Map;for(const[f,p]of r.associations)(f instanceof zi||f instanceof on)&&d.set(f,p);return u.traverse(f=>{const p=r.associations.get(f);p!=null&&d.set(f,p)}),d};return r.associations=c(s),s})}_createAnimationTracks(e,t,i,r,s){const o=[],a=e.name?e.name:e.uuid,l=[];Rr[s.path]===Rr.weights?e.traverse(function(f){f.morphTargetInfluences&&l.push(f.name?f.name:f.uuid)}):l.push(a);let c;switch(Rr[s.path]){case Rr.weights:c=zo;break;case Rr.rotation:c=Ho;break;case Rr.position:case Rr.scale:c=Vo;break;default:switch(i.itemSize){case 1:c=zo;break;case 2:case 3:default:c=Vo;break}break}const u=r.interpolation!==void 0?y2[r.interpolation]:ol,d=this._getArrayFromAccessor(i);for(let f=0,p=l.length;f<p;f++){const g=new c(l[f]+"."+Rr[s.path],t.array,d,u);r.interpolation==="CUBICSPLINE"&&this._createCubicSplineTrackInterpolant(g),o.push(g)}return o}_getArrayFromAccessor(e){let t=e.array;if(e.normalized){const i=Dh(t.constructor),r=new Float32Array(t.length);for(let s=0,o=t.length;s<o;s++)r[s]=t[s]*i;t=r}return t}_createCubicSplineTrackInterpolant(e){e.createInterpolant=function(i){const r=this instanceof Ho?v2:ey;return new r(this.times,this.values,this.getValueSize()/3,i)},e.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}}function R2(n,e,t){const i=e.attributes,r=new Ri;if(i.POSITION!==void 0){const a=t.json.accessors[i.POSITION],l=a.min,c=a.max;if(l!==void 0&&c!==void 0){if(r.set(new N(l[0],l[1],l[2]),new N(c[0],c[1],c[2])),a.normalized){const u=Dh(wo[a.componentType]);r.min.multiplyScalar(u),r.max.multiplyScalar(u)}}else{console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");return}}else return;const s=e.targets;if(s!==void 0){const a=new N,l=new N;for(let c=0,u=s.length;c<u;c++){const d=s[c];if(d.POSITION!==void 0){const f=t.json.accessors[d.POSITION],p=f.min,g=f.max;if(p!==void 0&&g!==void 0){if(l.setX(Math.max(Math.abs(p[0]),Math.abs(g[0]))),l.setY(Math.max(Math.abs(p[1]),Math.abs(g[1]))),l.setZ(Math.max(Math.abs(p[2]),Math.abs(g[2]))),f.normalized){const v=Dh(wo[f.componentType]);l.multiplyScalar(v)}a.max(l)}else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.")}}r.expandByVector(a)}n.boundingBox=r;const o=new Ci;r.getCenter(o.center),o.radius=r.min.distanceTo(r.max)/2,n.boundingSphere=o}function V0(n,e,t){const i=e.attributes,r=[];function s(o,a){return t.getDependency("accessor",o).then(function(l){n.setAttribute(a,l)})}for(const o in i){const a=Nh[o]||o.toLowerCase();a in n.attributes||r.push(s(i[o],a))}if(e.indices!==void 0&&!n.index){const o=t.getDependency("accessor",e.indices).then(function(a){n.setIndex(a)});r.push(o)}return mt.workingColorSpace!==an&&"COLOR_0"in i&&console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${mt.workingColorSpace}" not supported.`),nr(n,e),R2(n,e,t),Promise.all(r).then(function(){return e.targets!==void 0?M2(n,e.targets,t):n})}const Gd=new WeakMap;class C2 extends Is{constructor(e){super(e),this.decoderPath="",this.decoderConfig={},this.decoderBinary=null,this.decoderPending=null,this.workerLimit=4,this.workerPool=[],this.workerNextTaskID=1,this.workerSourceURL="",this.defaultAttributeIDs={position:"POSITION",normal:"NORMAL",color:"COLOR",uv:"TEX_COORD"},this.defaultAttributeTypes={position:"Float32Array",normal:"Float32Array",color:"Float32Array",uv:"Float32Array"}}setDecoderPath(e){return this.decoderPath=e,this}setDecoderConfig(e){return this.decoderConfig=e,this}setWorkerLimit(e){return this.workerLimit=e,this}load(e,t,i,r){const s=new lu(this.manager);s.setPath(this.path),s.setResponseType("arraybuffer"),s.setRequestHeader(this.requestHeader),s.setWithCredentials(this.withCredentials),s.load(e,o=>{this.parse(o,t,r)},i,r)}parse(e,t,i=()=>{}){this.decodeDracoFile(e,t,null,null,Jt,i).catch(i)}decodeDracoFile(e,t,i,r,s=an,o=()=>{}){const a={attributeIDs:i||this.defaultAttributeIDs,attributeTypes:r||this.defaultAttributeTypes,useUniqueIDs:!!i,vertexColorSpace:s};return this.decodeGeometry(e,a).then(t).catch(o)}decodeGeometry(e,t){const i=JSON.stringify(t);if(Gd.has(e)){const l=Gd.get(e);if(l.key===i)return l.promise;if(e.byteLength===0)throw new Error("THREE.DRACOLoader: Unable to re-decode a buffer with different settings. Buffer has already been transferred.")}let r;const s=this.workerNextTaskID++,o=e.byteLength,a=this._getWorker(s,o).then(l=>(r=l,new Promise((c,u)=>{r._callbacks[s]={resolve:c,reject:u},r.postMessage({type:"decode",id:s,taskConfig:t,buffer:e},[e])}))).then(l=>this._createGeometry(l.geometry));return a.catch(()=>!0).then(()=>{r&&s&&this._releaseTask(r,s)}),Gd.set(e,{key:i,promise:a}),a}_createGeometry(e){const t=new di;e.index&&t.setIndex(new hn(e.index.array,1));for(let i=0;i<e.attributes.length;i++){const r=e.attributes[i],s=r.name,o=r.array,a=r.itemSize,l=new hn(o,a);s==="color"&&(this._assignVertexColorSpace(l,r.vertexColorSpace),l.normalized=!(o instanceof Float32Array)),t.setAttribute(s,l)}return t}_assignVertexColorSpace(e,t){if(t!==Jt)return;const i=new Ke;for(let r=0,s=e.count;r<s;r++)i.fromBufferAttribute(e,r),mt.toWorkingColorSpace(i,Jt),e.setXYZ(r,i.r,i.g,i.b)}_loadLibrary(e,t){const i=new lu(this.manager);return i.setPath(this.decoderPath),i.setResponseType(t),i.setWithCredentials(this.withCredentials),new Promise((r,s)=>{i.load(e,r,void 0,s)})}preload(){return this._initDecoder(),this}_initDecoder(){if(this.decoderPending)return this.decoderPending;const e=typeof WebAssembly!="object"||this.decoderConfig.type==="js",t=[];return e?t.push(this._loadLibrary("draco_decoder.js","text")):(t.push(this._loadLibrary("draco_wasm_wrapper.js","text")),t.push(this._loadLibrary("draco_decoder.wasm","arraybuffer"))),this.decoderPending=Promise.all(t).then(i=>{const r=i[0];e||(this.decoderConfig.wasmBinary=i[1]);const s=P2.toString(),o=["/* draco decoder */",r,"","/* worker */",s.substring(s.indexOf("{")+1,s.lastIndexOf("}"))].join(`
`);this.workerSourceURL=URL.createObjectURL(new Blob([o]))}),this.decoderPending}_getWorker(e,t){return this._initDecoder().then(()=>{if(this.workerPool.length<this.workerLimit){const r=new Worker(this.workerSourceURL);r._callbacks={},r._taskCosts={},r._taskLoad=0,r.postMessage({type:"init",decoderConfig:this.decoderConfig}),r.onmessage=function(s){const o=s.data;switch(o.type){case"decode":r._callbacks[o.id].resolve(o);break;case"error":r._callbacks[o.id].reject(o);break;default:console.error('THREE.DRACOLoader: Unexpected message, "'+o.type+'"')}},this.workerPool.push(r)}else this.workerPool.sort(function(r,s){return r._taskLoad>s._taskLoad?-1:1});const i=this.workerPool[this.workerPool.length-1];return i._taskCosts[e]=t,i._taskLoad+=t,i})}_releaseTask(e,t){e._taskLoad-=e._taskCosts[t],delete e._callbacks[t],delete e._taskCosts[t]}debug(){console.log("Task load: ",this.workerPool.map(e=>e._taskLoad))}dispose(){for(let e=0;e<this.workerPool.length;++e)this.workerPool[e].terminate();return this.workerPool.length=0,this.workerSourceURL!==""&&URL.revokeObjectURL(this.workerSourceURL),this}}function P2(){let n,e;onmessage=function(o){const a=o.data;switch(a.type){case"init":n=a.decoderConfig,e=new Promise(function(u){n.onModuleLoaded=function(d){u({draco:d})},DracoDecoderModule(n)});break;case"decode":const l=a.buffer,c=a.taskConfig;e.then(u=>{const d=u.draco,f=new d.Decoder;try{const p=t(d,f,new Int8Array(l),c),g=p.attributes.map(v=>v.array.buffer);p.index&&g.push(p.index.array.buffer),self.postMessage({type:"decode",id:a.id,geometry:p},g)}catch(p){console.error(p),self.postMessage({type:"error",id:a.id,error:p.message})}finally{d.destroy(f)}});break}};function t(o,a,l,c){const u=c.attributeIDs,d=c.attributeTypes;let f,p;const g=a.GetEncodedGeometryType(l);if(g===o.TRIANGULAR_MESH)f=new o.Mesh,p=a.DecodeArrayToMesh(l,l.byteLength,f);else if(g===o.POINT_CLOUD)f=new o.PointCloud,p=a.DecodeArrayToPointCloud(l,l.byteLength,f);else throw new Error("THREE.DRACOLoader: Unexpected geometry type.");if(!p.ok()||f.ptr===0)throw new Error("THREE.DRACOLoader: Decoding failed: "+p.error_msg());const v={index:null,attributes:[]};for(const m in u){const h=self[d[m]];let _,x;if(c.useUniqueIDs)x=u[m],_=a.GetAttributeByUniqueId(f,x);else{if(x=a.GetAttributeId(f,o[u[m]]),x===-1)continue;_=a.GetAttribute(f,x)}const M=r(o,a,f,m,h,_);m==="color"&&(M.vertexColorSpace=c.vertexColorSpace),v.attributes.push(M)}return g===o.TRIANGULAR_MESH&&(v.index=i(o,a,f)),o.destroy(f),v}function i(o,a,l){const u=l.num_faces()*3,d=u*4,f=o._malloc(d);a.GetTrianglesUInt32Array(l,d,f);const p=new Uint32Array(o.HEAPF32.buffer,f,u).slice();return o._free(f),{array:p,itemSize:1}}function r(o,a,l,c,u,d){const f=d.num_components(),g=l.num_points()*f,v=g*u.BYTES_PER_ELEMENT,m=s(o,u),h=o._malloc(v);a.GetAttributeDataArrayForAllPoints(l,d,m,v,h);const _=new u(o.HEAPF32.buffer,h,g).slice();return o._free(h),{name:c,array:_,itemSize:f}}function s(o,a){switch(a){case Float32Array:return o.DT_FLOAT32;case Int8Array:return o.DT_INT8;case Int16Array:return o.DT_INT16;case Int32Array:return o.DT_INT32;case Uint8Array:return o.DT_UINT8;case Uint16Array:return o.DT_UINT16;case Uint32Array:return o.DT_UINT32}}}const G0={type:"change"},Zp={type:"start"},ty={type:"end"},cc=new Xo,W0=new rr,L2=Math.cos(70*Lv.DEG2RAD),$t=new N,In=2*Math.PI,bt={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},Wd=1e-6;class N2 extends KR{constructor(e,t=null){super(e,t),this.state=bt.NONE,this.enabled=!0,this.target=new N,this.cursor=new N,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:yo.ROTATE,MIDDLE:yo.DOLLY,RIGHT:yo.PAN},this.touches={ONE:fo.ROTATE,TWO:fo.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._domElementKeyEvents=null,this._lastPosition=new N,this._lastQuaternion=new Vi,this._lastTargetPosition=new N,this._quat=new Vi().setFromUnitVectors(e.up,new N(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new k0,this._sphericalDelta=new k0,this._scale=1,this._panOffset=new N,this._rotateStart=new He,this._rotateEnd=new He,this._rotateDelta=new He,this._panStart=new He,this._panEnd=new He,this._panDelta=new He,this._dollyStart=new He,this._dollyEnd=new He,this._dollyDelta=new He,this._dollyDirection=new N,this._mouse=new He,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=I2.bind(this),this._onPointerDown=D2.bind(this),this._onPointerUp=U2.bind(this),this._onContextMenu=V2.bind(this),this._onMouseWheel=F2.bind(this),this._onKeyDown=B2.bind(this),this._onTouchStart=z2.bind(this),this._onTouchMove=H2.bind(this),this._onMouseDown=k2.bind(this),this._onMouseMove=O2.bind(this),this._interceptControlDown=G2.bind(this),this._interceptControlUp=W2.bind(this),this.domElement!==null&&this.connect(),this.update()}connect(){this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(G0),this.update(),this.state=bt.NONE}update(e=null){const t=this.object.position;$t.copy(t).sub(this.target),$t.applyQuaternion(this._quat),this._spherical.setFromVector3($t),this.autoRotate&&this.state===bt.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let i=this.minAzimuthAngle,r=this.maxAzimuthAngle;isFinite(i)&&isFinite(r)&&(i<-Math.PI?i+=In:i>Math.PI&&(i-=In),r<-Math.PI?r+=In:r>Math.PI&&(r-=In),i<=r?this._spherical.theta=Math.max(i,Math.min(r,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(i+r)/2?Math.max(i,this._spherical.theta):Math.min(r,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let s=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{const o=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),s=o!=this._spherical.radius}if($t.setFromSpherical(this._spherical),$t.applyQuaternion(this._quatInverse),t.copy(this.target).add($t),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let o=null;if(this.object.isPerspectiveCamera){const a=$t.length();o=this._clampDistance(a*this._scale);const l=a-o;this.object.position.addScaledVector(this._dollyDirection,l),this.object.updateMatrixWorld(),s=!!l}else if(this.object.isOrthographicCamera){const a=new N(this._mouse.x,this._mouse.y,0);a.unproject(this.object);const l=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),s=l!==this.object.zoom;const c=new N(this._mouse.x,this._mouse.y,0);c.unproject(this.object),this.object.position.sub(c).add(a),this.object.updateMatrixWorld(),o=$t.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;o!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(o).add(this.object.position):(cc.origin.copy(this.object.position),cc.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(cc.direction))<L2?this.object.lookAt(this.target):(W0.setFromNormalAndCoplanarPoint(this.object.up,this.target),cc.intersectPlane(W0,this.target))))}else if(this.object.isOrthographicCamera){const o=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),o!==this.object.zoom&&(this.object.updateProjectionMatrix(),s=!0)}return this._scale=1,this._performCursorZoom=!1,s||this._lastPosition.distanceToSquared(this.object.position)>Wd||8*(1-this._lastQuaternion.dot(this.object.quaternion))>Wd||this._lastTargetPosition.distanceToSquared(this.target)>Wd?(this.dispatchEvent(G0),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e!==null?In/60*this.autoRotateSpeed*e:In/60/60*this.autoRotateSpeed}_getZoomScale(e){const t=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){$t.setFromMatrixColumn(t,0),$t.multiplyScalar(-e),this._panOffset.add($t)}_panUp(e,t){this.screenSpacePanning===!0?$t.setFromMatrixColumn(t,1):($t.setFromMatrixColumn(t,0),$t.crossVectors(this.object.up,$t)),$t.multiplyScalar(e),this._panOffset.add($t)}_pan(e,t){const i=this.domElement;if(this.object.isPerspectiveCamera){const r=this.object.position;$t.copy(r).sub(this.target);let s=$t.length();s*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*s/i.clientHeight,this.object.matrix),this._panUp(2*t*s/i.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/i.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/i.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;const i=this.domElement.getBoundingClientRect(),r=e-i.left,s=t-i.top,o=i.width,a=i.height;this._mouse.x=r/o*2-1,this._mouse.y=-(s/a)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const t=this.domElement;this._rotateLeft(In*this._rotateDelta.x/t.clientHeight),this._rotateUp(In*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this._rotateUp(In*this.rotateSpeed/this.domElement.clientHeight):this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this._rotateUp(-In*this.rotateSpeed/this.domElement.clientHeight):this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this._rotateLeft(In*this.rotateSpeed/this.domElement.clientHeight):this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this._rotateLeft(-In*this.rotateSpeed/this.domElement.clientHeight):this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._rotateStart.set(i,r)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panStart.set(i,r)}}_handleTouchStartDolly(e){const t=this._getSecondPointerPosition(e),i=e.pageX-t.x,r=e.pageY-t.y,s=Math.sqrt(i*i+r*r);this._dollyStart.set(0,s)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{const i=this._getSecondPointerPosition(e),r=.5*(e.pageX+i.x),s=.5*(e.pageY+i.y);this._rotateEnd.set(r,s)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const t=this.domElement;this._rotateLeft(In*this._rotateDelta.x/t.clientHeight),this._rotateUp(In*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panEnd.set(i,r)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){const t=this._getSecondPointerPosition(e),i=e.pageX-t.x,r=e.pageY-t.y,s=Math.sqrt(i*i+r*r);this._dollyEnd.set(0,s),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);const o=(e.pageX+t.x)*.5,a=(e.pageY+t.y)*.5;this._updateZoomParameters(o,a)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new He,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){const t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){const t=e.deltaMode,i={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:i.deltaY*=16;break;case 2:i.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(i.deltaY*=10),i}}function D2(n){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(n.pointerId),this.domElement.addEventListener("pointermove",this._onPointerMove),this.domElement.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(n)&&(this._addPointer(n),n.pointerType==="touch"?this._onTouchStart(n):this._onMouseDown(n)))}function I2(n){this.enabled!==!1&&(n.pointerType==="touch"?this._onTouchMove(n):this._onMouseMove(n))}function U2(n){switch(this._removePointer(n),this._pointers.length){case 0:this.domElement.releasePointerCapture(n.pointerId),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(ty),this.state=bt.NONE;break;case 1:const e=this._pointers[0],t=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:t.x,pageY:t.y});break}}function k2(n){let e;switch(n.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case yo.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(n),this.state=bt.DOLLY;break;case yo.ROTATE:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=bt.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=bt.ROTATE}break;case yo.PAN:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=bt.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=bt.PAN}break;default:this.state=bt.NONE}this.state!==bt.NONE&&this.dispatchEvent(Zp)}function O2(n){switch(this.state){case bt.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(n);break;case bt.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(n);break;case bt.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(n);break}}function F2(n){this.enabled===!1||this.enableZoom===!1||this.state!==bt.NONE||(n.preventDefault(),this.dispatchEvent(Zp),this._handleMouseWheel(this._customWheelEvent(n)),this.dispatchEvent(ty))}function B2(n){this.enabled===!1||this.enablePan===!1||this._handleKeyDown(n)}function z2(n){switch(this._trackPointer(n),this._pointers.length){case 1:switch(this.touches.ONE){case fo.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(n),this.state=bt.TOUCH_ROTATE;break;case fo.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(n),this.state=bt.TOUCH_PAN;break;default:this.state=bt.NONE}break;case 2:switch(this.touches.TWO){case fo.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(n),this.state=bt.TOUCH_DOLLY_PAN;break;case fo.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(n),this.state=bt.TOUCH_DOLLY_ROTATE;break;default:this.state=bt.NONE}break;default:this.state=bt.NONE}this.state!==bt.NONE&&this.dispatchEvent(Zp)}function H2(n){switch(this._trackPointer(n),this.state){case bt.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(n),this.update();break;case bt.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(n),this.update();break;case bt.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(n),this.update();break;case bt.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(n),this.update();break;default:this.state=bt.NONE}}function V2(n){this.enabled!==!1&&n.preventDefault()}function G2(n){n.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function W2(n){n.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}const j2="glb_viewer_home_v1",j0="glb_viewer_mode_v1",X0="glb_viewer_measures_v1",Y0="glb_viewer_annotations_v1",K0="glb_viewer_unit_v1",q0="glb_viewer_media_v1",X2={unlit:"Unlit (Metashape-style)",lit:"Lit (PBR)",wireframe:"Wireframe"},$0={m:"Meters (m)",cm:"Centimeters (cm)",mm:"Millimeters (mm)",km:"Kilometers (km)",ft:"Feet (ft)",in:"Inches (in)"},Ih={m:1,cm:100,mm:1e3,km:.001,ft:3.28084,in:39.3701},ny={m:"m",cm:"cm",mm:"mm",km:"km",ft:"ft",in:"in"},Y2={m:"m²",cm:"cm²",mm:"mm²",km:"km²",ft:"ft²",in:"in²"},uc=["#3b82f6","#2563eb","#00d4aa","#ffb347","#7ec8e3","#ff7f50"],jd=["#00d4aa","#2563eb","#ffb347","#7ec8e3","#93c5fd","#ffffff"],Z0=new Set(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","w","a","s","d","W","A","S","D","q","e","Q","E","r","f","R","F","Shift"]),sr=[.001,.005,.01,.05,.1,.25,.5,1,2,5,10,25,50,100,250,500,1e3];function ya(n){if(!n)return"0 B";const e=1024,t=["B","KB","MB","GB"],i=Math.floor(Math.log(n)/Math.log(e));return`${parseFloat((n/Math.pow(e,i)).toFixed(2))} ${t[i]}`}function K2(n){return n<1e3?`${n}ms`:`${(n/1e3).toFixed(1)}s`}function q2(n){return sr.reduce((e,t,i)=>Math.abs(t-n)<Math.abs(sr[e]-n)?i:e,Math.floor(sr.length/2))}function $2(n){return n<.01?n.toFixed(3):n<.1?n.toFixed(2):n<10?n.toFixed(1):n>=1e3?`${(n/1e3).toFixed(0)}k`:n.toFixed(0)}function Sa(){return Math.random().toString(36).slice(2,9)}function Z2(n,e){return n*Ih[e]}function Xd(n,e){return`${Z2(n,e).toFixed(3)} ${ny[e]}`}function J0(n,e){return`${(n*Ih[e]*Ih[e]).toFixed(3)} ${Y2[e]}`}function Q0(n){if(n.length<3)return 0;const e=new N,t=n.map(r=>new N(r.x,r.y,r.z));for(let r=0;r<t.length;r++){const s=t[r],o=t[(r+1)%t.length],a=t[(r+2)%t.length],l=o.clone().sub(s),c=a.clone().sub(s);e.add(new N().crossVectors(l,c))}e.normalize();let i=0;for(let r=0;r<t.length;r++){const s=t[r],o=t[(r+1)%t.length];i+=s.clone().cross(o).dot(e)}return Math.abs(i)/2}function J2(n){let e=0;for(let t=0;t<n.length;t++){const i=n[t],r=n[(t+1)%n.length];e+=new N(i.x,i.y,i.z).distanceTo(new N(r.x,r.y,r.z))}return e}function e_(n){if(n.length<2)return 0;let e=0;for(let t=0;t<n.length-1;t++)e+=new N(n[t].x,n[t].y,n[t].z).distanceTo(new N(n[t+1].x,n[t+1].y,n[t+1].z));return e}function Ma(n,e){try{const t=localStorage.getItem(n);return t?JSON.parse(t):e}catch{return e}}function us(n,e){try{localStorage.setItem(n,JSON.stringify(e))}catch{}}function Yd(n){return`glb_home_${n.replace(/[^a-zA-Z0-9]/g,"_")}`}function t_(n){return new Promise((e,t)=>{const i=new FileReader;i.onload=()=>e(i.result),i.onerror=()=>t(new Error("Failed to read file")),i.readAsDataURL(n)})}const cu=new C2;cu.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");cu.preload();const si=new N;function ds(n,e,t,i){return si.set(n.x,n.y,n.z),si.project(e),si.z<-1||si.z>1?null:[(si.x*.5+.5)*t,(-si.y*.5+.5)*i]}function n_(n,e,t,i,r,s){for(const o of n){if(si.set(o.point.x,o.point.y,o.point.z),si.project(e),si.z<-1||si.z>1)continue;const a=(si.x*.5+.5)*r,l=(-si.y*.5+.5)*s,c=a-t,u=l-i;if(c*c+u*u<484)return o.id}return null}const fs="/file-server";function Q2(){const n=new URLSearchParams(window.location.search),e=n.get("schoolId")??"",t=n.get("schoolName")??"",i=q.useRef(null),r=q.useRef(null),s=q.useRef(null),o=q.useRef(null),a=q.useRef(null),l=q.useRef(null),c=q.useRef(0),u=q.useRef(null),d=q.useRef(new Set),f=q.useRef(new N),p=q.useRef(1),g=q.useRef(null),v=q.useRef(""),m=q.useRef(new Map),h=q.useRef(new Map),_=q.useRef(new YR),x=q.useRef(null),M=q.useRef(null),L=q.useRef(0),A=q.useRef([]),T=q.useRef(-1),I=q.useRef(()=>{}),[K,y]=q.useState("idle"),[w,X]=q.useState(0),[W,$]=q.useState(""),[se,j]=q.useState(null),[Q,U]=q.useState(null),[ie,re]=q.useState(!1),[fe,Oe]=q.useState(!1),[it,Y]=q.useState(7),[ae,Me]=q.useState(!1),[ve,qe]=q.useState(!1),[Fe,lt]=q.useState(()=>Ma(j0,"unlit")),[ge,Qe]=q.useState(null),[D,mn]=q.useState("all"),[Ge,dt]=q.useState(()=>Ma(K0,"m")),[Ue,St]=q.useState(()=>Ma(X0,[])),[ke,b]=q.useState(()=>Ma(Y0,[])),[S,B]=q.useState([]),Z=q.useRef([]);q.useEffect(()=>{Z.current=S},[S]);const oe=q.useRef([]),ee=q.useRef([]);q.useEffect(()=>{oe.current=ke},[ke]),q.useEffect(()=>{ee.current=Ue},[Ue]);const De=q.useRef(null),pe=q.useCallback(()=>{e&&(De.current&&clearTimeout(De.current),De.current=setTimeout(()=>{fetch(`${fs}/schools/${e}/viewer-state`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({home:g.current,annotations:oe.current,measures:ee.current,mediaPoints:At.current})}).catch(()=>{})},800))},[e]),[we,ct]=q.useState(!1),[ce,Ae]=q.useState(!1),[Ye,We]=q.useState(!1),be=q.useRef(0),[rt,je]=q.useState(null),[_t,k]=q.useState(""),[xe,G]=q.useState(null),[te,ye]=q.useState(jd[0]),[ue,Je]=q.useState(()=>Ma(q0,[])),At=q.useRef([]);q.useEffect(()=>{At.current=ue},[ue]);const Yt=q.useRef(!1),ut=q.useRef(null),ln=q.useRef(!1),Ln=q.useRef(null),Qr=q.useRef(null),[Gt,Jn]=q.useState(!1),[es,fi]=q.useState(!1),[Qn,ei]=q.useState(null),[Pi,Nn]=q.useState("images"),[Us,$o]=q.useState(!1),[Zo,xr]=q.useState(""),[Jo,E]=q.useState(""),[O,V]=q.useState(""),[z,F]=q.useState(null),[de,Se]=q.useState(-1),[Ce,Le]=q.useState(0);q.useEffect(()=>{Yt.current=Gt},[Gt]),q.useEffect(()=>{ut.current=ge},[ge]),q.useEffect(()=>{ln.current=es},[es]),q.useEffect(()=>{us(X0,Ue),pe()},[Ue,pe]),q.useEffect(()=>{us(Y0,ke),pe()},[ke,pe]),q.useEffect(()=>{us(K0,Ge)},[Ge]),q.useEffect(()=>{us(q0,ue),pe()},[ue,pe]);const Be=q.useCallback(C=>{const H=u.current;H&&H.traverse(P=>{const J=P;if(J.isMesh)if(C==="wireframe")J.material=new cr({color:7820799,wireframe:!0});else if(C==="unlit"){const ne=h.current.get(J);ne&&(J.material=ne)}else{const ne=m.current.get(J);ne&&(J.material=ne)}})},[]);q.useEffect(()=>{K==="viewing"&&u.current&&(Be(Fe),us(j0,Fe))},[Fe,K,Be]);const ze=q.useCallback(async(C,H,P,J)=>{var sm,om,am,lm;X(90),$("Building scene…"),y("viewing"),await new Promise(It=>{const Tt=()=>{o.current&&a.current&&l.current?It():setTimeout(Tt,16)};setTimeout(Tt,0)});const ne=o.current,me=a.current,Ie=l.current,Ee=((sm=s.current)==null?void 0:sm.capabilities.getMaxAnisotropy())??16;u.current&&(ne.remove(u.current),u.current=null);const Te=C.scene,et=It=>{It&&(It.anisotropy=Ee,It.minFilter=Oi,It.magFilter=kn,It.needsUpdate=!0)};Te.traverse(It=>{const Tt=It;if(!Tt.isMesh)return;m.current.set(Tt,Tt.material),(Array.isArray(Tt.material)?Tt.material:[Tt.material]).forEach(hy=>{["map","normalMap","roughnessMap","metalnessMap","emissiveMap","aoMap"].forEach(py=>et(hy[py]))});const ts=Array.isArray(Tt.material)?Tt.material[0]:Tt.material,ns=ts.map??null;ns&&et(ns);const ta=new cr({map:ns,vertexColors:ts.vertexColors??!1,side:ts.side??Hi,transparent:ts.transparent??!1,opacity:ts.opacity??1,alphaTest:ts.alphaTest??0});h.current.set(Tt,ta)}),ne.add(Te),u.current=Te,Te.updateMatrixWorld(!0);let $e=new Ri().setFromObject(Te);$e.isEmpty()&&$e.set(new N(-1,-1,-1),new N(1,1,1));const he=$e.getCenter(new N);Te.position.set(-he.x,-$e.min.y,-he.z),Te.updateMatrixWorld(!0),$e=new Ri().setFromObject(Te),Be(Fe);const Ve=$e.getSize(new N),pt=Math.max(Ve.x,Ve.y,Ve.z),st=$e.getCenter(new N),vt=$e.getBoundingSphere(new Ci).radius,Xe=me.fov*(Math.PI/180),Ht=vt/Math.tan(Xe/2)*1.4;me.near=Ht*1e-4,me.far=Ht*100,me.updateProjectionMatrix();let jt=null;try{const It=localStorage.getItem(Yd(H));It&&(jt=JSON.parse(It))}catch{}if(e)try{const It=await fetch(`${fs}/schools/${e}/viewer-state`);if(It.ok){const Tt=await It.json();Tt.home&&(jt=Tt.home),(om=Tt.annotations)!=null&&om.length&&b(Tt.annotations),(am=Tt.measures)!=null&&am.length&&St(Tt.measures),(lm=Tt.mediaPoints)!=null&&lm.length&&Je(Tt.mediaPoints)}}catch{}if(jt)me.position.set(jt.position.x,jt.position.y,jt.position.z),me.near=jt.near,me.far=jt.far,me.updateProjectionMatrix(),Ie.target.set(jt.target.x,jt.target.y,jt.target.z),g.current=jt,Me(!0);else{const It=new N(Ht*.6,Ht*.8,Ht*.6);me.position.copy(It),me.lookAt(st),Ie.target.copy(st),g.current={position:{x:It.x,y:It.y,z:It.z},target:{x:st.x,y:st.y,z:st.z},near:me.near,far:me.far},Me(!1)}Ie.minDistance=me.near*10,Ie.maxDistance=me.far,Ie.update(),setTimeout(()=>I.current(),120);const Xi=Math.max(.001,pt*.003);p.current=Xi,Y(q2(Xi));const yr=ne.children.find(It=>It instanceof Bd);yr&&ne.remove(yr);const Yi=Math.max(Ve.x,Ve.z)*3,fy=Math.min(100,Math.max(10,Math.floor(Yi/(pt*.1)))),_l=new Bd(Yi,fy,858682,858682);_l.material.opacity=.5,_l.material.transparent=!0,_l.position.y=0,ne.add(_l);let tm=0,nm=0,im=0;const rm=new Set;Te.traverse(It=>{const Tt=It;if(!Tt.isMesh)return;nm++;const xl=Tt.geometry;tm+=xl.index?xl.index.count/3:xl.attributes.position.count/3,(Array.isArray(Tt.material)?Tt.material:[Tt.material]).forEach(ns=>{["map","normalMap","roughnessMap","metalnessMap","emissiveMap"].forEach(ta=>{ns[ta]&&!rm.has(ns[ta])&&(rm.add(ns[ta]),im++)})})}),U({fileName:H,fileSize:P,loadTime:Date.now()-J,triangles:Math.round(tm),meshes:nm,textures:im}),X(100),$("Done!")},[Fe,Be,e]),Ne=q.useCallback(C=>{Qe(H=>{const P=H!==C;return P&&C!=="annotate"&&ct(!0),P?C:null}),mn("all"),B([]),x.current=null,G(null)},[]),xt=q.useCallback(()=>{mn(C=>C==="all"?"annotations":C==="annotations"?"measures":C==="measures"?"clear":"all")},[]),Rt=q.useCallback(()=>{St([]),b([]),B([]),x.current=null,G(null)},[]),Pt=q.useCallback(()=>{const C=r.current,H=a.current;if(!C||!H)return;const P=C.getContext("2d");if(!P)return;const J=C.width,ne=C.height;P.clearRect(0,0,J,ne);const me=(he,Ve,pt=!1)=>{if(he.length<2)return;P.beginPath(),P.strokeStyle=Ve,P.lineWidth=2,pt?P.setLineDash([6,4]):P.setLineDash([]);let st=!1;for(let vt=0;vt<he.length;vt++){const Xe=ds(he[vt],H,J,ne);if(!Xe){st=!1;continue}st?P.lineTo(Xe[0],Xe[1]):(P.moveTo(Xe[0],Xe[1]),st=!0)}P.stroke()},Ie=(he,Ve,pt=!0)=>{if(he.length<2)return;P.beginPath(),P.strokeStyle=Ve,P.lineWidth=2,P.setLineDash([]);let st=!1,vt=null;for(let yr=0;yr<he.length;yr++){const Yi=ds(he[yr],H,J,ne);Yi&&(st?P.lineTo(Yi[0],Yi[1]):(P.moveTo(Yi[0],Yi[1]),st=!0,vt=Yi))}pt&&vt&&st&&P.lineTo(vt[0],vt[1]);const Xe=Ve.replace("#",""),Ht=parseInt(Xe.slice(0,2),16),jt=parseInt(Xe.slice(2,4),16),Xi=parseInt(Xe.slice(4,6),16);P.fillStyle=`rgba(${Ht},${jt},${Xi},0.08)`,P.fill(),st&&P.stroke()},Ee=(he,Ve,pt=6)=>{const st=ds(he,H,J,ne);if(!st)return;const[vt,Xe]=st;P.beginPath(),P.arc(vt,Xe,pt,0,Math.PI*2),P.fillStyle=Ve,P.fill(),P.strokeStyle="#ffffff",P.lineWidth=1.5,P.setLineDash([]),P.stroke(),P.beginPath(),P.arc(vt,Xe,pt+1.5,0,Math.PI*2),P.strokeStyle="rgba(0,0,0,0.3)",P.lineWidth=1,P.stroke()},Te=(he,Ve,pt,st=0)=>{const vt=ds(he,H,J,ne);if(!vt)return;const[Xe,Ht]=vt,jt=Xe+10,Xi=Ht-10+st;P.font="bold 11px 'JetBrains Mono', monospace";const yr=P.measureText(Ve);P.fillStyle="rgba(6,11,26,0.82)",P.beginPath(),P.roundRect(jt-4,Xi-13,yr.width+10,18,5),P.fill(),P.fillStyle=pt,P.fillText(Ve,jt+1,Xi)};(D==="all"||D==="measures")&&Ue.forEach(he=>{he.mode==="distance"?(me(he.points,he.color),he.points.forEach(Ve=>Ee(Ve,he.color,5)),he.points.length>=2&&Te(he.points[he.points.length-1],he.label,he.color,-22)):(Ie(he.points,he.color,!0),he.points.forEach(Ve=>Ee(Ve,he.color,4)),he.points.length>=2&&Te(he.points[0],he.label,he.color))});const et=x.current,$e=uc[be.current%uc.length];if(ge&&ge!=="annotate"){et&&Ee(et,$e,4);const he=Z.current;if(he.length>0){if(he.length>=2&&me(he,$e,!1),ge==="area"){const Ve=et?[...he,et]:he;Ie(Ve,$e,!1)}if(et){const Ve=he[he.length-1];me([Ve,et],$e,!0),ge!=="distance"&&he.length>=2&&me([he[0],et],$e,!0)}if(he.forEach(Ve=>Ee(Ve,$e,5)),et){let Ve="";if(ge==="area"){const pt=[...he,et];Ve=J0(Q0(pt),Ge)}else{let pt=e_(he);const st=new N(he[he.length-1].x,he[he.length-1].y,he[he.length-1].z).distanceTo(new N(et.x,et.y,et.z));let vt=pt+st;if(ge==="perimeter"&&he.length>=2){const Xe=new N(he[0].x,he[0].y,he[0].z).distanceTo(new N(et.x,et.y,et.z));vt+=Xe}Ve=Xd(vt,Ge)}Te(et,Ve,$e,-22)}}}(D==="all"||D==="annotations")&&ke.forEach(he=>{Ee(he.point,he.color,7);const Ve=ds(he.point,H,J,ne);if(!Ve)return;const[pt,st]=Ve;P.font="bold 11px 'JetBrains Mono', monospace";const vt=he.text.split(`
`),Xe=Math.max(...vt.map(jt=>P.measureText(jt).width)),Ht=vt.length*15+10;P.fillStyle="rgba(6,11,26,0.88)",P.beginPath(),P.roundRect(pt+12,st-16,Xe+14,Ht,7),P.fill(),P.strokeStyle=he.color,P.lineWidth=1,P.setLineDash([]),P.stroke(),P.fillStyle=he.color,vt.forEach((jt,Xi)=>P.fillText(jt,pt+18,st-4+Xi*15))}),xe&&Ee(xe,te,7),(D==="all"||D==="annotations")&&ue.forEach(he=>{const Ve=ds(he.point,H,J,ne);if(!Ve)return;const[pt,st]=Ve;P.beginPath(),P.arc(pt,st,15,0,Math.PI*2),P.fillStyle="rgba(251,191,36,0.12)",P.fill(),P.beginPath(),P.arc(pt,st,11,0,Math.PI*2),P.fillStyle=Gt?"rgba(251,191,36,0.95)":"rgba(251,191,36,0.82)",P.fill(),P.strokeStyle="#fff",P.lineWidth=2,P.setLineDash([]),P.stroke(),P.font="11px sans-serif",P.textAlign="center",P.textBaseline="middle",P.fillText("📸",pt,st),P.textAlign="left",P.textBaseline="alphabetic";const vt=`${he.title||"Media"}${he.items.length?` (${he.items.length})`:""}`;Te(he.point,vt,"#fbbf24",-26)})},[Ue,ge,Ge,ke,xe,D,te,ue,Gt]),cn=q.useRef(()=>{});q.useEffect(()=>{cn.current=Pt},[Pt]);const ft=q.useCallback(()=>{if(!i.current)return;const C=i.current.clientWidth,H=i.current.clientHeight,P=new aR({antialias:!0,alpha:!1,precision:"highp",powerPreference:"high-performance",preserveDrawingBuffer:!0});P.setSize(C,H),P.setPixelRatio(Math.min(window.devicePixelRatio,3)),P.outputColorSpace=Jt,P.toneMapping=dr,P.shadowMap.enabled=!1,i.current.appendChild(P.domElement),s.current=P;const J=new lR;J.background=new Ke(657935),o.current=J;const ne=new bn(45,C/H,.001,1e6);ne.position.set(0,2,5),a.current=ne,J.add(new kR(16777215,1));const me=new Ph(16777215,1.5);me.position.set(5,10,7),J.add(me);const Ie=new Ph(16777215,.5);Ie.position.set(-5,3,-5),J.add(Ie);const Ee=new Bd(40,40,1710638,1710638);Ee.material.opacity=.4,Ee.material.transparent=!0,J.add(Ee);const Te=new N2(ne,P.domElement);Te.enableDamping=!0,Te.dampingFactor=.06,Te.minDistance=.001,Te.maxDistance=1e6,l.current=Te;const et={t:null};Te.addEventListener("end",()=>{et.t&&clearTimeout(et.t),et.t=setTimeout(()=>I.current(),300)});const $e=new N,he=new N,Ve=new N,pt=new N(0,1,0),st=()=>{c.current=requestAnimationFrame(st);const Xe=d.current;if(Xe.size>0&&!ge){ne.getWorldDirection(Ve),Ve.y=0,Ve.normalize(),he.crossVectors(Ve,pt).normalize(),$e.set(0,0,0);const Ht=p.current*(Xe.has("Shift")?.32:.08);(Xe.has("ArrowUp")||Xe.has("w")||Xe.has("W"))&&$e.addScaledVector(Ve,Ht),(Xe.has("ArrowDown")||Xe.has("s")||Xe.has("S"))&&$e.addScaledVector(Ve,-Ht),(Xe.has("ArrowLeft")||Xe.has("a")||Xe.has("A"))&&$e.addScaledVector(he,-Ht),(Xe.has("ArrowRight")||Xe.has("d")||Xe.has("D"))&&$e.addScaledVector(he,Ht),(Xe.has("e")||Xe.has("E"))&&$e.addScaledVector(pt,Ht),(Xe.has("q")||Xe.has("Q")||Xe.has("f")||Xe.has("F"))&&$e.addScaledVector(pt,-Ht),f.current.add($e)}f.current.multiplyScalar(.85),f.current.lengthSq()>1e-6&&(ne.position.add(f.current),Te.target.add(f.current)),Te.update(),P.render(J,ne),r.current&&cn.current()};st();const vt=()=>{if(!i.current)return;const Xe=i.current.clientWidth,Ht=i.current.clientHeight;ne.aspect=Xe/Ht,ne.updateProjectionMatrix(),P.setSize(Xe,Ht),r.current&&(r.current.width=Xe,r.current.height=Ht)};return window.addEventListener("resize",vt),()=>window.removeEventListener("resize",vt)},[]);q.useEffect(()=>{if(K!=="viewing")return;const C=ft();return()=>{var H,P;C==null||C(),cancelAnimationFrame(c.current),(H=s.current)==null||H.dispose(),i.current&&((P=s.current)==null?void 0:P.domElement.parentNode)===i.current&&i.current.removeChild(s.current.domElement)}},[K,ft]),q.useEffect(()=>{if(K!=="viewing")return;const C=()=>{const H=r.current;!H||!i.current||(H.width=i.current.clientWidth,H.height=i.current.clientHeight)};return C(),window.addEventListener("resize",C),()=>window.removeEventListener("resize",C)},[K]);const Pe=q.useCallback(()=>{if(!S.length||ge==="annotate")return;if(S.length<2){B([]),x.current=null;return}const C=uc[be.current%uc.length];be.current++;let H=0,P="";ge==="distance"?(H=e_(S),P=Xd(H,Ge)):ge==="area"?(H=Q0(S),P=J0(H,Ge)):ge==="perimeter"&&(H=J2(S),P=Xd(H,Ge));const J={id:Sa(),points:[...S],mode:ge,result:H,unit:Ge,label:P,color:C};St(ne=>[...ne,J]),B([]),x.current=null},[S,ge,Ge]);q.useEffect(()=>{if(K!=="viewing")return;const C={t:null},H=ne=>{if(ne.key===" "){ne.preventDefault(),ge||(f.current.set(0,0,0),d.current.clear());return}Z0.has(ne.key)&&(ge||(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(ne.key)&&ne.preventDefault(),d.current.add(ne.key)))},P=ne=>{d.current.delete(ne.key),Z0.has(ne.key)&&d.current.size===0&&(C.t&&clearTimeout(C.t),C.t=setTimeout(()=>I.current(),400))},J=ne=>{ne.key==="Escape"&&(B([]),Qe(null),x.current=null,G(null),Jn(!1),fi(!1),F(null)),ne.key==="Enter"&&ge&&S.length>=2&&Pe()};return window.addEventListener("keydown",H),window.addEventListener("keyup",P),window.addEventListener("keydown",J),()=>{window.removeEventListener("keydown",H),window.removeEventListener("keyup",P),window.removeEventListener("keydown",J),d.current.clear(),f.current.set(0,0,0),C.t&&clearTimeout(C.t)}},[K,ge,S,Pe]),q.useEffect(()=>{l.current&&(l.current.enabled=!ge,ge&&f.current.set(0,0,0))},[ge]);const Wt=q.useCallback(C=>{const H=r.current,P=a.current,J=u.current;if(!H||!P||!J)return null;const ne=H.getBoundingClientRect(),me=new He((C.clientX-ne.left)/ne.width*2-1,-((C.clientY-ne.top)/ne.height)*2+1);_.current.setFromCamera(me,P);const Ie=_.current.intersectObject(J,!0);if(!Ie.length){const Ee=new N;P.getWorldDirection(Ee);const Te=P.position.clone().add(Ee.multiplyScalar(10));return{x:Te.x,y:Te.y,z:Te.z}}return{x:Ie[0].point.x,y:Ie[0].point.y,z:Ie[0].point.z}},[]),ht=q.useCallback(C=>{const H=r.current,P=a.current;if(!H||!P)return null;const J=H.getBoundingClientRect(),ne=new He((C.clientX-J.left)/J.width*2-1,-((C.clientY-J.top)/J.height)*2+1);_.current.setFromCamera(ne,P);const me=new rr,Ie=new N;P.getWorldDirection(Ie);let Ee=new N;const Te=Z.current;if(Te.length>0){const he=Te[Te.length-1];Ee.set(he.x,he.y,he.z)}else l.current&&Ee.copy(l.current.target);me.setFromNormalAndCoplanarPoint(Ie.multiplyScalar(-1),Ee);const et=new N;return _.current.ray.intersectPlane(me,et)?{x:et.x,y:et.y,z:et.z}:null},[]),Vn=q.useCallback(C=>{if(!ge){x.current=null;return}if(x.current=ht(C),ge==="annotate"){const H=performance.now();if(H-L.current>33){L.current=H;const P=r.current,J=a.current,ne=u.current;if(P&&J&&ne){const me=P.getBoundingClientRect(),Ie=new He((C.clientX-me.left)/me.width*2-1,-((C.clientY-me.top)/me.height)*2+1);_.current.setFromCamera(Ie,J);const Ee=_.current.intersectObject(ne,!0);if(Ee.length)M.current={x:Ee[0].point.x,y:Ee[0].point.y,z:Ee[0].point.z};else{const Te=new N;J.getWorldDirection(Te);const et=J.position.clone().add(Te.multiplyScalar(10));M.current={x:et.x,y:et.y,z:et.z}}}}}},[ge,ht]),vr=q.useCallback(C=>{if(Gt){const ne=r.current,me=a.current;if(ne&&me){const Te=ne.getBoundingClientRect(),et=C.clientX-Te.left,$e=C.clientY-Te.top,he=ne.width,Ve=ne.height;for(const pt of At.current){const st=ds(pt.point,me,he,Ve);if(!st)continue;const vt=st[0]-et,Xe=st[1]-$e;if(Math.sqrt(vt*vt+Xe*Xe)<20){ei(pt.id),xr(pt.title),Nn("images"),fi(!0);return}}}const Ie=Wt(C);if(!Ie)return;const Ee=Sa();Je(Te=>[...Te,{id:Ee,point:Ie,title:"",comment:"",items:[]}]),ei(Ee),xr(""),E(""),Nn("images"),fi(!0);return}if(!ge)return;if(ge==="annotate"){const ne=M.current??Wt(C);if(M.current=null,!ne)return;G(ne),k(""),je(null),ye(jd[0]);return}const H=x.current;if(!H)return;const P=Z.current;if(P.length>0){const ne=P[P.length-1];if(new N(ne.x,ne.y,ne.z).distanceTo(new N(H.x,H.y,H.z))<1e-6)return}const J=[...P,H];Z.current=J,B(J)},[Gt,ge,Wt]),Mn=q.useCallback(()=>{!ge||ge==="annotate"||S.length>=2&&Pe()},[ge,S,Pe]),Qo=q.useCallback(C=>{C.preventDefault(),ge&&(S.length>=2?Pe():(Qe(null),B([]),x.current=null,G(null)))},[ge,S,Pe]),kt=q.useCallback(()=>{const C=a.current,H=l.current;if(!C||!H)return;let P=g.current;if(v.current)try{const J=localStorage.getItem(Yd(v.current));J&&(P=JSON.parse(J))}catch{}P&&(C.position.set(P.position.x,P.position.y,P.position.z),C.near=P.near,C.far=P.far,C.updateProjectionMatrix(),H.target.set(P.target.x,P.target.y,P.target.z),H.update(),f.current.set(0,0,0))},[]),Li=q.useCallback(()=>{const C=a.current,H=l.current;if(!C||!H)return;const P={position:{x:C.position.x,y:C.position.y,z:C.position.z},target:{x:H.target.x,y:H.target.y,z:H.target.z},near:C.near,far:C.far};g.current=P,us(j2,P),v.current&&us(Yd(v.current),P),e&&fetch(`${fs}/schools/${e}/viewer-state`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({home:P,annotations:oe.current,measures:ee.current})}).catch(()=>{}),Me(!0),qe(!0),setTimeout(()=>qe(!1),1200)},[e]),ks=q.useCallback(()=>{const C=a.current,H=l.current;if(!C||!H)return;const P={position:{x:C.position.x,y:C.position.y,z:C.position.z},target:{x:H.target.x,y:H.target.y,z:H.target.z},near:C.near,far:C.far},J=A.current.slice(0,T.current+1);J.push(P),J.length>50&&J.shift(),A.current=J;const ne=J.length-1;T.current=ne,Se(ne),Le(J.length)},[]);q.useEffect(()=>{I.current=ks},[ks]);const Dn=q.useCallback(()=>{const C=T.current-1;if(C<0)return;const H=A.current[C],P=a.current,J=l.current;!P||!J||!H||(P.position.set(H.position.x,H.position.y,H.position.z),P.near=H.near,P.far=H.far,P.updateProjectionMatrix(),J.target.set(H.target.x,H.target.y,H.target.z),J.update(),f.current.set(0,0,0),T.current=C,Se(C))},[]),ea=q.useCallback(()=>{const C=T.current+1;if(C>=A.current.length)return;const H=A.current[C],P=a.current,J=l.current;!P||!J||!H||(P.position.set(H.position.x,H.position.y,H.position.z),P.near=H.near,P.far=H.far,P.updateProjectionMatrix(),J.target.set(H.target.x,H.target.y,H.target.z),J.update(),f.current.set(0,0,0),T.current=C,Se(C))},[]),Lu=q.useCallback(()=>{Y(C=>{const H=Math.min(C+1,sr.length-1);return p.current=sr[H],H})},[]),gl=q.useCallback(()=>{Y(C=>{const H=Math.max(C-1,0);return p.current=sr[H],H})},[]),ry=q.useCallback(()=>{const C=s.current,H=r.current;if(!C||!H)return;C.render(o.current,a.current),cn.current();const P=C.domElement,J=document.createElement("canvas");J.width=P.width,J.height=P.height;const ne=J.getContext("2d");if(!ne)return;ne.drawImage(P,0,0),ne.drawImage(H,0,0,J.width,J.height);const me=J.toDataURL("image/png"),Ie=t?t.replace(/[^a-zA-Z0-9]+/g,"_").replace(/^_+|_+$/g,""):"rtb_3d_viewer",Ee=document.createElement("a");Ee.href=me,Ee.download=`${Ie}_${new Date().toISOString().slice(0,10)}.png`,Ee.click(),Ae(!0),setTimeout(()=>Ae(!1),1400)},[]),Jp=q.useCallback(async C=>{j(null),y("loading"),X(0),$("Reading file…"),m.current.clear(),h.current.clear(),f.current.set(0,0,0),v.current=C.name;const H=Date.now();try{const P=await new Promise((me,Ie)=>{const Ee=new FileReader;Ee.onprogress=Te=>{Te.lengthComputable&&(X(Math.round(Te.loaded/Te.total*75)),$(`Reading… ${ya(Te.loaded)} / ${ya(Te.total)}`))},Ee.onload=()=>me(Ee.result),Ee.onerror=()=>Ie(new Error("File read failed")),Ee.readAsArrayBuffer(C)});X(78),$("Parsing GLB…");const J=new F0;J.setDRACOLoader(cu);const ne=await new Promise((me,Ie)=>{J.parse(P,"",Ee=>me(Ee),Ee=>Ie(Ee))});await ze(ne,C.name,C.size,H)}catch(P){j((P==null?void 0:P.message)||"Failed to load model"),y("idle")}},[ze]),sy=q.useCallback(async(C,H)=>{j(null),y("loading"),X(0),$("Loading model…"),m.current.clear(),h.current.clear(),f.current.set(0,0,0),v.current=H;const P=Date.now();let J=0;try{const ne=new F0;ne.setDRACOLoader(cu);const me=await new Promise((Ie,Ee)=>{ne.load(C,Ie,Te=>{Te.lengthComputable&&(J=Te.total,X(Math.round(Te.loaded/Te.total*85)),$(`${ya(Te.loaded)} / ${ya(Te.total)}`))},Te=>Ee(Te instanceof Error?Te:new Error(String(Te))))});await ze(me,H,J,P)}catch(ne){j((ne==null?void 0:ne.message)||"Failed to load model"),y("idle")}},[ze]);q.useEffect(()=>{e&&fetch(`${fs}/schools/${e}/3d`).then(C=>C.ok?C.json():Promise.reject(new Error("No 3D model found for this school"))).then(C=>sy(`${fs}${C.url}`,C.filename)).catch(C=>j(C.message))},[]);const Qp=q.useCallback(C=>{if(!C.name.toLowerCase().endsWith(".glb")){j("Only .glb files are supported.");return}Jp(C)},[Jp]),oy=C=>{var P;const H=(P=C.target.files)==null?void 0:P[0];H&&Qp(H)},ay=C=>{var P;C.preventDefault(),re(!1);const H=(P=C.dataTransfer.files)==null?void 0:P[0];H&&Qp(H)},em=()=>{if(!_t.trim()){G(null);return}rt?(b(C=>C.map(H=>H.id===rt?{...H,text:_t,color:te}:H)),je(null)):xe&&b(C=>[...C,{id:Sa(),point:xe,text:_t,color:te}]),G(null),k("")},ly=q.useCallback(C=>{if(ut.current||!Ln.current)return;const H=a.current,P=r.current;if(!H||!P)return;const J=At.current;if(J.length){const ne=P.getBoundingClientRect(),me=C.clientX-ne.left,Ie=C.clientY-ne.top,Ee=n_(J,H,me,Ie,P.width,P.height);Ee!==Qr.current&&(Qr.current=Ee,Ln.current.style.cursor=Ee?"pointer":Yt.current?"crosshair":"")}else Qr.current&&(Qr.current=null,Ln.current.style.cursor=Yt.current?"crosshair":"");if(Yt.current){const ne=performance.now();if(ne-L.current>33){L.current=ne;const me=u.current;if(me){const Ie=P.getBoundingClientRect(),Ee=new He((C.clientX-Ie.left)/Ie.width*2-1,-((C.clientY-Ie.top)/Ie.height)*2+1);_.current.setFromCamera(Ee,H);const Te=_.current.intersectObject(me,!0);if(Te.length)M.current={x:Te[0].point.x,y:Te[0].point.y,z:Te[0].point.z};else{const et=new N;H.getWorldDirection(et);const $e=H.position.clone().add(et.multiplyScalar(10));M.current={x:$e.x,y:$e.y,z:$e.z}}}}}},[]),cy=q.useCallback(C=>{if(ut.current)return;const H=a.current,P=r.current;if(!H||!P)return;const J=P.getBoundingClientRect(),ne=C.clientX-J.left,me=C.clientY-J.top,Ie=n_(At.current,H,ne,me,P.width,P.height);if(Ie){const $e=At.current.find(he=>he.id===Ie);if(!$e)return;ei($e.id),xr($e.title),E($e.comment??""),Nn("images"),fi(!0);return}if(!Yt.current||ln.current)return;let Ee;const Te=M.current;if(M.current=null,Te)Ee=Te;else{const $e=u.current;if(!$e)return;const he=new He((C.clientX-J.left)/J.width*2-1,-((C.clientY-J.top)/J.height)*2+1);_.current.setFromCamera(he,H);const Ve=_.current.intersectObject($e,!0);if(Ve.length)Ee={x:Ve[0].point.x,y:Ve[0].point.y,z:Ve[0].point.z};else{const pt=new N;H.getWorldDirection(pt);const st=H.position.clone().add(pt.multiplyScalar(10));Ee={x:st.x,y:st.y,z:st.z}}}const et=Sa();Je($e=>[...$e,{id:et,point:Ee,title:"",comment:"",items:[]}]),ei(et),xr(""),E(""),Nn("images"),fi(!0)},[]),Nu=q.useCallback(C=>{const H=document.createElement("a");H.href=C.url,H.download=C.filename,H.click()},[]),uy=q.useCallback(C=>{ei(C.id),xr(C.title),E(C.comment??""),Nn("images"),fi(!0)},[]),dy=q.useCallback(async(C,H,P)=>{const J=C.type.startsWith("video/")?"video":"image";$o(!0);try{let ne;if(e){const Ie=new FormData;Ie.append("file",C);const Ee=await fetch(`${fs}/schools/${e}/media`,{method:"POST",body:Ie});if(Ee.ok){const Te=await Ee.json();ne=`${fs}${Te.url}`}else ne=await t_(C)}else ne=await t_(C);const me={id:Sa(),filename:C.name,url:ne,title:H.trim()||C.name,type:J};Je(Ie=>Ie.map(Ee=>Ee.id===P?{...Ee,items:[...Ee.items,me]}:Ee))}catch{}$o(!1),V("")},[e]);return R.jsxs(R.Fragment,{children:[R.jsx("style",{children:`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body,#root{width:100%;height:100%;overflow:hidden}
        body{background:#060b1a}
        .glb-root{width:100vw;height:100vh;background:#060b1a;display:flex;flex-direction:column;font-family:'Inter',sans-serif;color:#e8e8f0;overflow:hidden}
        .header{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(6,11,26,0.95);backdrop-filter:blur(12px);z-index:10;flex-shrink:0}
        .logo{display:flex;align-items:center;gap:10px;font-size:17px;font-weight:800;letter-spacing:-0.5px}
        .logo-icon{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#2563eb);display:flex;align-items:center;justify-content:center;font-size:14px}
        .badge{font-family:'JetBrains Mono',monospace;font-size:10px;padding:3px 8px;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.35);border-radius:20px;color:#60a5fa;letter-spacing:0.5px}
        .drop-zone{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:40px;position:relative;overflow:hidden}
        .drop-zone::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 40% at 50% 50%,rgba(59,130,246,0.08) 0%,transparent 70%),radial-gradient(ellipse 40% 30% at 20% 80%,rgba(37,99,235,0.05) 0%,transparent 60%);pointer-events:none}
        .drop-target{width:100%;max-width:520px;aspect-ratio:4/3;border:2px dashed rgba(59,130,246,0.35);border-radius:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;cursor:pointer;transition:all .25s ease;background:rgba(59,130,246,0.03);position:relative;overflow:hidden}
        .drop-target.dragging{border-color:rgba(59,130,246,0.8);background:rgba(59,130,246,0.08);transform:scale(1.01)}
        .drop-icon{width:72px;height:72px;border-radius:18px;background:linear-gradient(135deg,rgba(59,130,246,0.2),rgba(37,99,235,0.1));border:1px solid rgba(59,130,246,0.3);display:flex;align-items:center;justify-content:center;font-size:30px;transition:transform .25s ease}
        .drop-target:hover .drop-icon,.drop-target.dragging .drop-icon{transform:scale(1.1) translateY(-4px)}
        .drop-title{font-size:20px;font-weight:700;letter-spacing:-0.5px;text-align:center}
        .drop-sub{font-size:12px;color:rgba(232,232,240,0.45);text-align:center;font-family:'JetBrains Mono',monospace;line-height:1.7}
        .upload-btn{padding:11px 26px;border-radius:10px;border:none;background:linear-gradient(135deg,#3b82f6,#60a5fa);color:#fff;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s ease}
        .upload-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(59,130,246,0.4)}
        .info-row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
        .info-card{padding:12px 18px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);text-align:center}
        .info-card-value{font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:500;color:#60a5fa}
        .info-card-label{font-size:10px;color:rgba(232,232,240,0.4);margin-top:3px;letter-spacing:0.5px;text-transform:uppercase}
        .error-bar{margin:0 24px;padding:10px 16px;border-radius:10px;background:rgba(255,71,71,0.08);border:1px solid rgba(255,71,71,0.25);color:#ff7070;font-size:12px;font-family:'JetBrains Mono',monospace;display:flex;align-items:center;gap:8px}
        .loading-overlay{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:40px;position:relative}
        .loading-overlay::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 50% 40% at 50% 50%,rgba(59,130,246,0.1) 0%,transparent 70%);pointer-events:none}
        .spinner-ring{width:72px;height:72px;border-radius:50%;border:3px solid rgba(59,130,246,0.15);border-top:3px solid #3b82f6;border-right:3px solid #2563eb;animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .loading-pct{font-size:44px;font-weight:800;letter-spacing:-2px;background:linear-gradient(135deg,#3b82f6,#2563eb);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .progress-track{width:300px;height:3px;background:rgba(255,255,255,0.07);border-radius:4px;overflow:hidden}
        .progress-fill{height:100%;background:linear-gradient(90deg,#3b82f6,#2563eb);border-radius:4px;transition:width .3s ease}
        .progress-label{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(232,232,240,0.45);letter-spacing:0.3px}
        .viewer-wrapper{flex:1;position:relative;overflow:hidden}
        .viewer-canvas{width:100%;height:100%;position:absolute;inset:0}
        .viewer-canvas canvas{display:block}
        .overlay-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5}
        .overlay-canvas.interactive{pointer-events:all;cursor:crosshair}
        .toolbar{position:absolute;top:16px;left:16px;display:flex;flex-direction:column;gap:8px;z-index:20}
        .tb-group{display:flex;flex-direction:column;gap:3px;background:rgba(6,11,26,0.88);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.09);border-radius:12px;padding:5px}
        .tb-btn{width:36px;height:36px;border-radius:8px;border:none;background:transparent;color:rgba(232,232,240,0.6);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .18s ease;font-size:15px;position:relative;flex-shrink:0;user-select:none}
        .tb-btn:hover{background:rgba(59,130,246,0.18);color:#93c5fd}
        .tb-btn.active{background:rgba(59,130,246,0.3);color:#93c5fd}
        .tb-btn.flash{background:rgba(50,220,120,0.25);color:#60e8a0}
        .tb-btn.danger:hover{background:rgba(255,71,71,0.18);color:#ff9090}
        .tb-btn:active{transform:scale(0.9)}
        .tb-btn:disabled{opacity:0.25;cursor:default;transform:none}
        .tb-divider{height:1px;background:rgba(255,255,255,0.07);margin:2px 4px}
        .tb-btn[data-tip]:hover::after{content:attr(data-tip);position:absolute;left:calc(100% + 10px);top:50%;transform:translateY(-50%);white-space:nowrap;background:rgba(6,11,26,0.97);border:1px solid rgba(255,255,255,0.1);border-radius:7px;padding:5px 10px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#e8e8f0;letter-spacing:0.3px;pointer-events:none;z-index:100}
        .speed-group{display:flex;flex-direction:column;gap:0;background:rgba(6,11,26,0.88);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.09);border-radius:12px;padding:5px;align-items:center}
        .speed-label{font-family:'JetBrains Mono',monospace;font-size:9px;color:rgba(232,232,240,0.35);text-transform:uppercase;letter-spacing:0.8px;padding:2px 0 3px;text-align:center;width:100%}
        .speed-val{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;color:#60a5fa;padding:3px 0;text-align:center;min-width:36px;letter-spacing:-0.3px}
        .speed-track{width:26px;height:3px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden;margin:1px 0 3px}
        .speed-fill{height:100%;background:linear-gradient(90deg,#3b82f6,#2563eb);border-radius:3px;transition:width .15s ease}
        .mode-panel{position:absolute;top:16px;right:16px;display:flex;flex-direction:column;gap:4px;z-index:20}
        .mode-label-hdr{font-family:'JetBrains Mono',monospace;font-size:9px;color:rgba(232,232,240,0.3);text-transform:uppercase;letter-spacing:1px;padding:0 4px 2px;text-align:right}
        .mode-btn{padding:7px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(6,11,26,0.88);backdrop-filter:blur(16px);color:rgba(232,232,240,0.45);font-family:'JetBrains Mono',monospace;font-size:10px;cursor:pointer;transition:all .18s ease;text-align:left;display:flex;align-items:center;gap:7px;white-space:nowrap}
        .mode-btn:hover{background:rgba(59,130,246,0.12);color:#93c5fd;border-color:rgba(59,130,246,0.3)}
        .mode-btn.active{background:rgba(59,130,246,0.2);color:#93c5fd;border-color:rgba(59,130,246,0.5)}
        .mode-dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,0.15);flex-shrink:0}
        .mode-btn.active .mode-dot{background:#60a5fa}
        .mode-tag{font-size:8px;padding:1px 5px;border-radius:4px;background:rgba(50,220,120,0.15);border:1px solid rgba(50,220,120,0.3);color:#60e8a0;margin-left:auto}
        .stats-panel{position:absolute;bottom:16px;left:16px;background:rgba(6,11,26,0.88);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.09);border-radius:14px;padding:12px 16px;display:flex;gap:16px;align-items:center;z-index:20}
        .stat-item{display:flex;flex-direction:column;gap:2px}
        .stat-val{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:500;color:#60a5fa}
        .stat-lbl{font-size:9px;color:rgba(232,232,240,0.35);text-transform:uppercase;letter-spacing:0.6px}
        .stat-div{width:1px;height:26px;background:rgba(255,255,255,0.07);flex-shrink:0}
        .home-toast{position:absolute;bottom:80px;left:16px;background:rgba(50,200,100,0.12);border:1px solid rgba(50,200,100,0.3);border-radius:8px;padding:7px 12px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#60e8a0;z-index:30;pointer-events:none;animation:toastIn .2s ease,toastOut .3s ease .9s forwards}
        .screenshot-toast{position:absolute;bottom:80px;right:16px;background:rgba(50,150,255,0.12);border:1px solid rgba(50,150,255,0.3);border-radius:8px;padding:7px 12px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#70b8ff;z-index:30;pointer-events:none;animation:toastIn .2s ease,toastOut .3s ease 1.1s forwards}
        @keyframes toastIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes toastOut{to{opacity:0;transform:translateY(-4px)}}

        /* Measure toolbar */
        .meas-toolbar{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;background:rgba(6,11,26,0.92);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:8px 12px;z-index:25;transition:all .25s ease}
        .meas-toolbar.active-mode{border-color:rgba(59,130,246,0.5);box-shadow:0 0 0 1px rgba(59,130,246,0.2),0 8px 32px rgba(0,0,0,0.5)}
        .meas-btn{height:34px;padding:0 14px;border-radius:9px;border:1px solid transparent;background:transparent;color:rgba(232,232,240,0.5);font-family:'JetBrains Mono',monospace;font-size:10px;cursor:pointer;transition:all .18s ease;display:flex;align-items:center;gap:6px;white-space:nowrap;font-weight:500}
        .meas-btn:hover{background:rgba(59,130,246,0.12);color:#93c5fd;border-color:rgba(59,130,246,0.25)}
        .meas-btn.active{background:rgba(59,130,246,0.22);color:#93c5fd;border-color:rgba(59,130,246,0.5)}
        .meas-btn.annotate-btn.active{background:rgba(0,212,170,0.15);color:#00d4aa;border-color:rgba(0,212,170,0.4)}
        .meas-divider{width:1px;height:22px;background:rgba(255,255,255,0.08);margin:0 2px}
        .meas-hint{font-family:'JetBrains Mono',monospace;font-size:9px;color:rgba(59,130,246,0.7);padding:0 4px;white-space:nowrap}

        /* Unit dropdown */
        .unit-wrap{position:relative}
        .unit-btn{height:34px;padding:0 10px;border-radius:9px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:rgba(232,232,240,0.65);font-family:'JetBrains Mono',monospace;font-size:10px;cursor:pointer;display:flex;align-items:center;gap:5px;white-space:nowrap;transition:all .18s ease}
        .unit-btn:hover{background:rgba(59,130,246,0.1);border-color:rgba(59,130,246,0.3);color:#93c5fd}
        .unit-dropdown{position:absolute;bottom:calc(100% + 6px);left:0;min-width:170px;background:#0d1429;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:5px;box-shadow:0 16px 48px rgba(0,0,0,0.7);z-index:100;animation:dropUp .15s ease}
        @keyframes dropUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        .unit-opt{width:100%;padding:8px 12px;border-radius:7px;border:none;background:transparent;color:rgba(232,232,240,0.55);font-family:'JetBrains Mono',monospace;font-size:10px;cursor:pointer;text-align:left;transition:all .15s ease;display:flex;justify-content:space-between;align-items:center}
        .unit-opt:hover{background:rgba(59,130,246,0.12);color:#93c5fd}
        .unit-opt.selected{color:#60a5fa;background:rgba(59,130,246,0.1)}
        .unit-opt .check{color:#60a5fa;font-size:12px}

        /* Measure panel (right drawer) */
        .meas-panel{position:absolute;right:16px;top:80px;bottom:80px;width:280px;background:rgba(6,11,26,0.94);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.09);border-radius:16px;z-index:20;display:flex;flex-direction:column;overflow:hidden;animation:panelIn .2s ease}
        @keyframes panelIn{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:none}}
        .mp-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 12px;border-bottom:1px solid rgba(255,255,255,0.07);flex-shrink:0}
        .mp-title{font-size:12px;font-weight:700;letter-spacing:-0.2px;display:flex;align-items:center;gap:8px}
        .mp-count{font-family:'JetBrains Mono',monospace;font-size:9px;padding:2px 7px;background:rgba(59,130,246,0.15);border-radius:20px;color:#60a5fa}
        .mp-clear{padding:4px 9px;border-radius:7px;border:none;background:rgba(255,71,71,0.08);color:rgba(255,112,112,0.7);font-family:'JetBrains Mono',monospace;font-size:9px;cursor:pointer;transition:all .15s}
        .mp-clear:hover{background:rgba(255,71,71,0.18);color:#ff7070}
        .mp-list{flex:1;overflow-y:auto;padding:8px}
        .mp-list::-webkit-scrollbar{width:4px}
        .mp-list::-webkit-scrollbar-track{background:transparent}
        .mp-list::-webkit-scrollbar-thumb{background:rgba(59,130,246,0.3);border-radius:2px}
        .mp-item{padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);margin-bottom:6px;background:rgba(255,255,255,0.02);transition:background .15s}
        .mp-item:hover{background:rgba(255,255,255,0.04)}
        .mp-item-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
        .mp-item-type{font-family:'JetBrains Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:1px;padding:2px 7px;border-radius:20px}
        .mp-item-del{width:20px;height:20px;border-radius:5px;border:none;background:transparent;color:rgba(255,112,112,0.4);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}
        .mp-item-del:hover{background:rgba(255,71,71,0.15);color:#ff7070}
        .mp-item-val{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:600;color:#e8e8f0;letter-spacing:-0.5px}
        .mp-item-pts{font-family:'JetBrains Mono',monospace;font-size:9px;color:rgba(232,232,240,0.3);margin-top:2px}
        .mp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:rgba(232,232,240,0.2);font-family:'JetBrains Mono',monospace;font-size:11px;text-align:center;padding:20px}
        .mp-empty-icon{font-size:28px;opacity:0.3}

        /* 🚀 Fast Annot dialog + Color Picker */
        .annot-dialog{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#0d1429;border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:20px;width:300px;z-index:60;box-shadow:0 32px 80px rgba(0,0,0,0.8);animation:popIn .05s ease-out forwards}
        @keyframes popIn{from{transform:translate(-50%,-45%) scale(0.95);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}
        .ad-title{font-size:13px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px}
        .ad-colors{display:flex;gap:8px;margin-bottom:12px;}
        .ad-color-btn{width:22px;height:22px;border-radius:50%;border:2px solid transparent;cursor:pointer;transition:transform 0.15s;}
        .ad-color-btn:hover{transform:scale(1.15);}
        .ad-color-btn.active{border-color:#ffffff;box-shadow:0 0 0 2px rgba(255,255,255,0.2);}
        .ad-textarea{width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:9px;padding:10px;font-family:'JetBrains Mono',monospace;font-size:11px;resize:vertical;min-height:70px;outline:none;transition:border .15s;line-height:1.6}
        .ad-textarea:focus{border-color:rgba(59,130,246,0.5)}
        .ad-row{display:flex;gap:8px;margin-top:12px;justify-content:flex-end}
        .ad-cancel{padding:7px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:rgba(232,232,240,0.5);font-family:'JetBrains Mono',monospace;font-size:10px;cursor:pointer;transition:all .15s}
        .ad-cancel:hover{background:rgba(255,255,255,0.06)}
        .ad-save{padding:7px 18px;border-radius:8px;border:none;background:linear-gradient(135deg,#3b82f6,#60a5fa);color:#fff;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;cursor:pointer;transition:all .15s}
        .ad-save:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(59,130,246,0.4)}

        /* Help */
        .help-backdrop{position:absolute;inset:0;z-index:50;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;animation:bfadeIn .18s ease}
        @keyframes bfadeIn{from{opacity:0}to{opacity:1}}
        .help-panel{width:580px;max-width:94vw;max-height:90vh;overflow-y:auto;background:#0d1429;border:1px solid rgba(255,255,255,0.1);border-radius:20px;box-shadow:0 40px 100px rgba(0,0,0,0.8);animation:bslideUp .22s ease}
        .help-header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px 16px;border-bottom:1px solid rgba(255,255,255,0.07);position:sticky;top:0;background:#0d1429;z-index:1;border-radius:20px 20px 0 0}
        .help-title{font-size:15px;font-weight:800;letter-spacing:-0.3px;display:flex;align-items:center;gap:10px}
        .help-title-icon{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#2563eb);display:flex;align-items:center;justify-content:center;font-size:13px}
        .help-close{width:28px;height:28px;border-radius:7px;border:none;background:rgba(255,255,255,0.06);color:rgba(232,232,240,0.6);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .15s}
        .help-close:hover{background:rgba(255,71,120,0.2);color:#ff7090}
        .help-body{padding:18px 22px 24px;display:flex;flex-direction:column;gap:20px}
        .help-section{display:flex;flex-direction:column;gap:8px}
        .help-section-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:rgba(232,232,240,0.3);padding:0 2px}
        .help-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}
        .help-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.025);transition:background .15s}
        .help-row:hover{background:rgba(59,130,246,0.07)}
        .help-keys{display:flex;gap:3px;flex-shrink:0;flex-wrap:wrap;max-width:130px}
        .kbd{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:20px;padding:0 5px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);border-bottom:2px solid rgba(255,255,255,0.2);border-radius:5px;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:600;color:#93c5fd;white-space:nowrap;line-height:1}
        .help-desc{font-size:11px;color:rgba(232,232,240,0.5);line-height:1.4;flex:1}
        .help-divider{height:1px;background:rgba(255,255,255,0.05)}
        .help-tip{padding:12px 14px;border-radius:10px;background:rgba(59,130,246,0.07);border:1px solid rgba(59,130,246,0.2);font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(157,122,255,0.8);line-height:1.8}
        .callout{padding:12px 14px;border-radius:10px;background:rgba(50,200,100,0.06);border:1px solid rgba(50,200,100,0.2);font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(96,232,160,0.9);line-height:1.9}

        /* ── Media modal ─────────────────────────────────────────────────── */
        .media-link-btn{display:flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;border:1px solid rgba(251,191,36,0.4);background:rgba(251,191,36,0.08);color:#fbbf24;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;cursor:pointer;transition:background .12s,border-color .12s,transform .12s;white-space:nowrap}
        .media-link-btn:hover{background:rgba(251,191,36,0.18);border-color:rgba(251,191,36,0.65);transform:translateY(-1px)}
        .media-link-count{font-size:9px;padding:1px 6px;background:rgba(251,191,36,0.22);border-radius:10px}
        /* Backdrop: always in DOM, GPU-composited opacity toggle, zero backdrop-filter */
        .media-backdrop{position:absolute;inset:0;z-index:70;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity 0.06s linear;will-change:opacity}
        .media-backdrop.open{opacity:1;pointer-events:all}
        .media-modal{width:720px;max-width:96vw;max-height:88vh;background:#0d1429;border:1px solid rgba(255,255,255,0.11);border-radius:20px;box-shadow:0 24px 80px rgba(0,0,0,0.9);display:flex;flex-direction:column;overflow:hidden;transform:scale(0.97) translateY(5px);opacity:0;transition:transform 0.08s ease-out,opacity 0.06s linear;will-change:transform,opacity}
        .media-backdrop.open .media-modal{transform:none;opacity:1}
        .mm-header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px 14px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;gap:16px}
        .mm-title-wrap{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}
        .mm-title-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(251,191,36,0.6)}
        .mm-title-input{font-size:15px;font-weight:700;letter-spacing:-0.4px;background:transparent;border:none;outline:none;color:#e8e8f0;width:100%;padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.07);transition:border-color .12s}
        .mm-title-input:focus{border-bottom-color:rgba(251,191,36,0.6)}
        .mm-title-input::placeholder{color:rgba(232,232,240,0.28)}
        .mm-comment-field{width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:7px;padding:7px 10px;font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(232,232,240,0.7);resize:none;outline:none;transition:border .1s;line-height:1.5;margin-top:6px}
        .mm-comment-field:focus{border-color:rgba(251,191,36,0.4)}
        .mm-comment-field::placeholder{color:rgba(232,232,240,0.22)}
        .mm-close{width:30px;height:30px;border-radius:8px;border:none;background:rgba(255,255,255,0.06);color:rgba(232,232,240,0.6);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:background .1s,color .1s;flex-shrink:0}
        .mm-close:hover{background:rgba(255,71,120,0.2);color:#ff7090}
        .mm-tabs{display:flex;padding:0 22px;border-bottom:1px solid rgba(255,255,255,0.07);flex-shrink:0;background:rgba(0,0,0,0.1)}
        .mm-tab{padding:11px 16px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;color:rgba(232,232,240,0.38);cursor:pointer;border:none;background:transparent;border-bottom:2px solid transparent;transition:color .1s,border-color .1s;white-space:nowrap;display:flex;align-items:center;gap:6px;margin-bottom:-1px}
        .mm-tab:hover{color:rgba(232,232,240,0.72)}
        .mm-tab.active{color:#93c5fd;border-bottom-color:#3b82f6}
        .mm-tab.tab-all.active{color:#fbbf24;border-bottom-color:#fbbf24}
        .mm-body{flex:1;overflow-y:auto;padding:20px 22px;display:flex;flex-direction:column;gap:16px;min-height:0}
        .mm-body::-webkit-scrollbar{width:4px}
        .mm-body::-webkit-scrollbar-track{background:transparent}
        .mm-body::-webkit-scrollbar-thumb{background:rgba(59,130,246,0.3);border-radius:2px}
        .mm-upload{border:2px dashed rgba(59,130,246,0.2);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px;background:rgba(59,130,246,0.02);transition:border-color .12s,background .12s}
        .mm-upload:hover{border-color:rgba(59,130,246,0.45);background:rgba(59,130,246,0.05)}
        .mm-upload-row{display:flex;gap:10px;align-items:center}
        .mm-title-field{flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:8px;padding:8px 12px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#e8e8f0;outline:none;transition:border .12s}
        .mm-title-field:focus{border-color:rgba(59,130,246,0.5)}
        .mm-title-field::placeholder{color:rgba(232,232,240,0.28)}
        .mm-upload-btn{height:34px;padding:0 16px;border-radius:9px;border:none;background:linear-gradient(135deg,#3b82f6,#60a5fa);color:#fff;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;transition:transform .1s,box-shadow .1s;white-space:nowrap}
        .mm-upload-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 16px rgba(59,130,246,0.35)}
        .mm-upload-btn:disabled{opacity:0.5;cursor:default}
        .mm-hint{font-family:'JetBrains Mono',monospace;font-size:9px;color:rgba(232,232,240,0.28)}
        .mm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:12px}
        .mm-card{border-radius:12px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;background:rgba(255,255,255,0.02);position:relative;transition:border-color .1s,background .1s}
        .mm-card:hover{border-color:rgba(59,130,246,0.3);background:rgba(255,255,255,0.04)}
        .mm-card img{width:100%;aspect-ratio:4/3;object-fit:cover;background:rgba(255,255,255,0.03);display:block;cursor:zoom-in;transition:opacity .08s}
        .mm-card img:hover{opacity:0.85}
        .mm-card video{width:100%;aspect-ratio:4/3;display:block;background:#060b1a}
        .mm-card-info{padding:8px 10px}
        .mm-card-title{font-family:'JetBrains Mono',monospace;font-size:9px;color:rgba(232,232,240,0.65);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .mm-card-del{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:6px;border:none;background:rgba(6,11,26,0.8);color:rgba(255,112,112,0.65);font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .08s,color .08s,opacity .08s;opacity:0}
        .mm-card:hover .mm-card-del{opacity:1}
        .mm-card-del:hover{background:rgba(255,71,71,0.28);color:#ff7070}
        .mm-card-expand{position:absolute;top:6px;left:6px;width:22px;height:22px;border-radius:6px;border:none;background:rgba(6,11,26,0.8);color:rgba(255,255,255,0.55);font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .08s,color .08s,opacity .08s;opacity:0}
        .mm-card:hover .mm-card-expand{opacity:1}
        .mm-card-expand:hover{background:rgba(59,130,246,0.55);color:#fff}
        .mm-card-dl{position:absolute;bottom:36px;right:6px;width:22px;height:22px;border-radius:6px;border:none;background:rgba(6,11,26,0.8);color:rgba(255,255,255,0.55);font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .08s,color .08s,opacity .08s;opacity:0}
        .mm-card:hover .mm-card-dl{opacity:1}
        .mm-card-dl:hover{background:rgba(50,200,100,0.5);color:#fff}
        .mm-point-comment{font-family:'JetBrains Mono',monospace;font-size:9px;color:rgba(232,232,240,0.45);font-style:italic;padding:0 2px 6px;line-height:1.5}
        .mm-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:48px 20px;color:rgba(232,232,240,0.2);font-family:'JetBrains Mono',monospace;font-size:11px;text-align:center}
        .mm-empty-icon{font-size:34px;opacity:0.3}
        .mm-point-section{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:14px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.015)}
        .mm-point-header{display:flex;align-items:center;gap:10px}
        .mm-point-dot{width:10px;height:10px;border-radius:50%;background:#fbbf24;flex-shrink:0}
        .mm-point-name{font-size:12px;font-weight:700;color:#fbbf24;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .mm-point-cnt{font-family:'JetBrains Mono',monospace;font-size:9px;padding:2px 7px;background:rgba(251,191,36,0.1);border-radius:20px;color:rgba(251,191,36,0.65)}
        .mm-open-btn{padding:3px 10px;border-radius:7px;border:1px solid rgba(251,191,36,0.25);background:transparent;color:rgba(251,191,36,0.65);font-family:'JetBrains Mono',monospace;font-size:9px;cursor:pointer;transition:background .1s,color .1s;white-space:nowrap}
        .mm-open-btn:hover{background:rgba(251,191,36,0.1);color:#fbbf24}
        .mm-del-pt{padding:3px 8px;border-radius:7px;border:1px solid rgba(255,71,71,0.2);background:transparent;color:rgba(255,112,112,0.5);font-family:'JetBrains Mono',monospace;font-size:9px;cursor:pointer;transition:background .1s,color .1s}
        .mm-del-pt:hover{background:rgba(255,71,71,0.12);color:#ff7070}
        /* ── Lightbox ──────────────────────────────────────────────────────── */
        .lightbox{position:absolute;inset:0;z-index:90;background:rgba(0,0,0,0.96);display:flex;align-items:center;justify-content:center;cursor:zoom-out;opacity:0;pointer-events:none;transition:opacity 0.07s linear;will-change:opacity}
        .lightbox.open{opacity:1;pointer-events:all}
        .lightbox-media-wrap{display:flex;align-items:center;justify-content:center;max-width:95vw;max-height:94vh;transform:scale(0.95);transition:transform 0.08s ease-out;will-change:transform}
        .lightbox.open .lightbox-media-wrap{transform:scale(1)}
        .lightbox img{max-width:95vw;max-height:92vh;object-fit:contain;border-radius:6px;box-shadow:0 0 100px rgba(0,0,0,0.7);display:block;cursor:default}
        .lightbox video{max-width:95vw;max-height:92vh;border-radius:6px;box-shadow:0 0 100px rgba(0,0,0,0.7);display:block}
        .lightbox-close{position:absolute;top:16px;right:16px;width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.85);font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .1s,transform .1s}
        .lightbox-close:hover{background:rgba(255,71,120,0.38);transform:scale(1.1)}
        .lightbox-caption{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(255,255,255,0.5);background:rgba(0,0,0,0.55);padding:5px 14px;border-radius:20px;white-space:nowrap;max-width:80vw;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
        .lightbox-dl{position:absolute;top:16px;right:64px;width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.85);font-size:17px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .1s,transform .1s}
        .lightbox-dl:hover{background:rgba(50,200,100,0.38);transform:scale(1.1)}
      `}),R.jsx("title",{children:t?`${t} · 3D Viewer — RTB GIS`:"RTB GIS · 3D Viewer"}),R.jsxs("div",{className:"glb-root",children:[R.jsxs("header",{className:"header",children:[R.jsxs("div",{className:"logo",children:[R.jsx("div",{className:"logo-icon",children:"⬡"}),R.jsxs("span",{style:{display:"flex",flexDirection:"column",gap:1},children:[R.jsx("span",{style:{fontSize:15,fontWeight:800,letterSpacing:"-0.4px"},children:t||"RTB GIS · 3D Viewer"}),t&&R.jsx("span",{style:{fontSize:9,fontWeight:500,opacity:.4,letterSpacing:"1.2px",fontFamily:"'JetBrains Mono', monospace",textTransform:"uppercase"},children:"Rwanda TVEt Board · 3D Photogrammetry Viewer"})]})]}),R.jsxs("div",{style:{display:"flex",alignItems:"center",gap:10},children:[Q&&w===100&&R.jsxs("span",{style:{fontFamily:"'JetBrains Mono', monospace",fontSize:9,color:"rgba(232,232,240,0.3)",letterSpacing:"0.3px"},children:[Q.triangles.toLocaleString(),"▲ · ",Q.meshes,"⬡ · ",Q.textures,"◈"]}),ue.length>0&&R.jsxs("button",{className:"media-link-btn",onClick:()=>{Nn("all"),ei(null),fi(!0)},children:["📸 Media ",R.jsx("span",{className:"media-link-count",children:ue.reduce((C,H)=>C+H.items.length,0)})]}),R.jsx("span",{className:"badge",children:"Measure · Annotate · Screenshot"})]})]}),se&&R.jsxs("div",{className:"error-bar",children:[R.jsx("span",{children:"⚠"})," ",se]}),K==="idle"&&R.jsxs("div",{className:"drop-zone",children:[R.jsxs("label",{className:`drop-target${ie?" dragging":""}`,onDragOver:C=>{C.preventDefault(),re(!0)},onDragLeave:()=>re(!1),onDrop:ay,htmlFor:"glb-input",children:[R.jsx("input",{id:"glb-input",type:"file",accept:".glb",style:{display:"none"},onChange:oy}),R.jsx("div",{className:"drop-icon",children:"⬡"}),R.jsx("div",{className:"drop-title",children:t?`No 3D model found for ${t}`:"Drop your .glb model here"}),R.jsxs("div",{className:"drop-sub",children:[t?"Upload a GLB file to view the 3D model for this school":"Measure distances · Areas · Perimeters",R.jsx("br",{}),t?"":"Annotations · Screenshot · Unlit photogrammetry"]}),R.jsx("button",{className:"upload-btn",type:"button",onClick:C=>{var H;C.preventDefault(),(H=document.getElementById("glb-input"))==null||H.click()},children:"Choose File"})]}),R.jsx("div",{className:"info-row",children:[{value:"2 GB+",label:"Max File Size"},{value:"GLB",label:"Format"},{value:"WebGL 2",label:"Renderer"},{value:"Measure",label:"Tools"}].map(C=>R.jsxs("div",{className:"info-card",children:[R.jsx("div",{className:"info-card-value",children:C.value}),R.jsx("div",{className:"info-card-label",children:C.label})]},C.label))})]}),K==="loading"&&R.jsxs("div",{className:"loading-overlay",children:[R.jsx("div",{className:"spinner-ring"}),R.jsxs("div",{className:"loading-pct",children:[w,"%"]}),R.jsx("div",{className:"progress-track",children:R.jsx("div",{className:"progress-fill",style:{width:`${w}%`}})}),R.jsx("div",{className:"progress-label",children:W})]}),K==="viewing"&&R.jsxs("div",{className:"viewer-wrapper",ref:Ln,onMouseMove:ly,onClick:cy,children:[w<100&&R.jsxs("div",{style:{position:"absolute",inset:0,zIndex:5,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:24,background:"rgba(6,11,26,0.78)",backdropFilter:"blur(6px)"},children:[R.jsx("div",{className:"spinner-ring"}),R.jsxs("div",{className:"loading-pct",children:[w,"%"]}),R.jsx("div",{className:"progress-track",children:R.jsx("div",{className:"progress-fill",style:{width:`${w}%`}})}),R.jsx("div",{className:"progress-label",children:W})]}),R.jsx("div",{ref:i,className:"viewer-canvas"}),R.jsx("canvas",{ref:r,className:`overlay-canvas${ge||Gt?"  interactive":""}`,style:{cursor:Gt?"crosshair":void 0},onMouseMove:Vn,onClick:vr,onDoubleClick:Mn,onContextMenu:Qo}),R.jsxs("div",{className:"toolbar",children:[R.jsxs("div",{className:"tb-group",children:[R.jsx("button",{className:"tb-btn","data-tip":"Reset to home",onClick:kt,children:"⊙"}),R.jsx("button",{className:`tb-btn${ve?" flash":""}`,"data-tip":ae?"Update auto-home position":"Save view as auto-home",onClick:Li,style:{fontSize:13},children:ve?"✓":ae?"🏠":"📍"}),R.jsx("div",{className:"tb-divider"}),R.jsx("button",{className:"tb-btn","data-tip":"Back (camera history)",onClick:Dn,disabled:de<=0,style:{fontSize:16,fontWeight:700},children:"‹"}),R.jsx("button",{className:"tb-btn","data-tip":"Forward (camera history)",onClick:ea,disabled:de>=Ce-1,style:{fontSize:16,fontWeight:700},children:"›"})]}),R.jsxs("div",{className:"speed-group",children:[R.jsx("div",{className:"speed-label",children:"speed"}),R.jsx("button",{className:"tb-btn","data-tip":"Speed up",onClick:Lu,disabled:it>=sr.length-1,style:{fontSize:18,fontWeight:700},children:"＋"}),R.jsx("div",{className:"speed-val",children:$2(sr[it])}),R.jsx("div",{className:"speed-track",children:R.jsx("div",{className:"speed-fill",style:{width:`${it/(sr.length-1)*100}%`}})}),R.jsx("button",{className:"tb-btn","data-tip":"Speed down",onClick:gl,disabled:it<=0,style:{fontSize:18,fontWeight:700},children:"−"})]}),R.jsxs("div",{className:"tb-group",children:[R.jsx("button",{className:`tb-btn${we?" active":""}`,"data-tip":"Measurements panel",onClick:()=>ct(C=>!C),style:{fontSize:13},children:"📐"}),R.jsx("button",{className:`tb-btn${ce?" flash":""}`,"data-tip":"Screenshot & download",onClick:ry,style:{fontSize:13},children:ce?"✓":"📷"}),R.jsx("div",{className:"tb-divider"}),R.jsxs("button",{className:`tb-btn${Gt?" active":""}`,"data-tip":Gt?"Exit media mode (Esc)":"Add / view media points",style:{fontSize:13,color:Gt?"#fbbf24":void 0},onClick:()=>{Jn(C=>!C),Gt||(Qe(null),B([]))},children:["📸",ue.length>0&&R.jsx("span",{style:{position:"absolute",top:2,right:2,width:14,height:14,borderRadius:"50%",background:"#fbbf24",color:"#000",fontSize:8,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'JetBrains Mono',monospace"},children:ue.length})]}),R.jsx("button",{className:`tb-btn${fe?" active":""}`,"data-tip":"Keyboard shortcuts",onClick:()=>Oe(C=>!C),children:"?"})]})]}),w===100&&R.jsxs("div",{className:"mode-panel",children:[R.jsx("div",{className:"mode-label-hdr",children:"Render mode"}),["unlit","lit","wireframe"].map(C=>R.jsxs("button",{className:`mode-btn${Fe===C?" active":""}`,onClick:()=>lt(C),children:[R.jsx("span",{className:"mode-dot"}),X2[C],C==="unlit"&&R.jsx("span",{className:"mode-tag",children:"recommended"})]},C))]}),Gt&&w===100&&R.jsxs("div",{style:{position:"absolute",top:16,left:"50%",transform:"translateX(-50%)",background:"rgba(251,191,36,0.12)",border:"1px solid rgba(251,191,36,0.4)",borderRadius:12,padding:"8px 18px",display:"flex",alignItems:"center",gap:10,zIndex:25,backdropFilter:"blur(16px)"},children:[R.jsx("span",{style:{fontSize:13},children:"📸"}),R.jsx("span",{style:{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"#fbbf24",fontWeight:600},children:"Media Mode — Click to place a point · Click existing point to view/add media"}),R.jsx("button",{style:{padding:"3px 10px",borderRadius:7,border:"1px solid rgba(251,191,36,0.35)",background:"transparent",color:"rgba(251,191,36,0.7)",fontFamily:"'JetBrains Mono',monospace",fontSize:9,cursor:"pointer"},onClick:()=>Jn(!1),children:"✕ Exit"})]}),w===100&&R.jsxs("div",{className:`meas-toolbar${ge?" active-mode":""}`,children:[R.jsxs("div",{className:"unit-wrap",children:[R.jsxs("button",{className:"unit-btn",onClick:()=>We(C=>!C),children:["📏 ",ny[Ge]," ▾"]}),Ye&&R.jsx("div",{className:"unit-dropdown",children:Object.keys($0).map(C=>R.jsxs("button",{className:`unit-opt${Ge===C?" selected":""}`,onClick:()=>{dt(C),We(!1)},children:[R.jsx("span",{children:$0[C]}),Ge===C&&R.jsx("span",{className:"check",children:"✓"})]},C))})]}),R.jsx("div",{className:"meas-divider"}),R.jsx("button",{className:`meas-btn${ge==="distance"?" active":""}`,onClick:()=>Ne("distance"),children:"📏 Distance"}),R.jsx("button",{className:`meas-btn${ge==="area"?" active":""}`,onClick:()=>Ne("area"),children:"⬛ Area"}),R.jsx("button",{className:`meas-btn${ge==="perimeter"?" active":""}`,onClick:()=>Ne("perimeter"),children:"🔲 Perimeter"}),R.jsx("button",{className:`meas-btn annotate-btn${ge==="annotate"?" active":""}`,onClick:()=>Ne("annotate"),children:"🏷 Annotate"}),R.jsxs("button",{className:`meas-btn${Gt?" active":""}`,style:{color:Gt?"#fbbf24":void 0,borderColor:Gt?"rgba(251,191,36,0.5)":void 0,background:Gt?"rgba(251,191,36,0.15)":void 0},onClick:()=>{Jn(C=>!C),!Gt&&(Qe(null),B([]))},children:["📸 Media",ue.length>0?` (${ue.length})`:""]}),(Ue.length>0||ke.length>0)&&R.jsxs(R.Fragment,{children:[R.jsx("div",{className:"meas-divider"}),R.jsxs("button",{className:"meas-btn",style:{fontWeight:600,color:D==="clear"?"#ff7070":"rgba(232,232,240,0.65)"},onClick:xt,children:[D==="all"&&"👁️ View All",D==="annotations"&&"🏷️ Annots Only",D==="measures"&&"📏 Meas Only",D==="clear"&&"🚫 Clear View"]})]}),ge&&S.length>=2&&ge!=="annotate"&&R.jsxs(R.Fragment,{children:[R.jsx("div",{className:"meas-divider"}),R.jsxs("button",{className:"meas-btn active",style:{background:"rgba(50,200,100,0.15)",borderColor:"rgba(50,200,100,0.4)",color:"#60e8a0"},onClick:Pe,children:["✓ Done (",S.length," pts)"]})]}),ge&&R.jsxs(R.Fragment,{children:[R.jsx("div",{className:"meas-divider"}),R.jsxs("span",{className:"meas-hint",children:[ge==="distance"&&"Click points → Right-click to finish",ge==="area"&&"Click points → Right-click to finish",ge==="perimeter"&&"Click points → Right-click to finish",ge==="annotate"&&"Click on model to place note"]}),R.jsx("div",{className:"meas-divider"}),R.jsx("button",{className:"meas-btn",style:{color:"rgba(255,112,112,0.7)"},onClick:()=>{Qe(null),B([]),x.current=null},children:"✕ Cancel"})]})]}),we&&R.jsxs("div",{className:"meas-panel",children:[R.jsxs("div",{className:"mp-header",children:[R.jsxs("div",{className:"mp-title",children:["📐 Measurements",R.jsx("span",{className:"mp-count",children:Ue.length+ke.length})]}),R.jsx("button",{className:"mp-clear",onClick:Rt,children:"Delete all"})]}),R.jsxs("div",{className:"mp-list",children:[Ue.length===0&&ke.length===0&&R.jsxs("div",{className:"mp-empty",children:[R.jsx("div",{className:"mp-empty-icon",children:"📐"}),R.jsxs("div",{children:["No measurements yet.",R.jsx("br",{}),"Use the toolbar below to start."]})]}),Ue.map(C=>R.jsxs("div",{className:"mp-item",children:[R.jsxs("div",{className:"mp-item-head",children:[R.jsx("span",{className:"mp-item-type",style:{background:`${C.color}22`,color:C.color,border:`1px solid ${C.color}44`},children:C.mode}),R.jsx("button",{className:"mp-item-del",onClick:()=>St(H=>H.filter(P=>P.id!==C.id)),children:"✕"})]}),R.jsx("div",{className:"mp-item-val",children:C.label}),R.jsxs("div",{className:"mp-item-pts",children:[C.points.length," point",C.points.length!==1?"s":""]})]},C.id)),ke.map(C=>R.jsxs("div",{className:"mp-item",children:[R.jsxs("div",{className:"mp-item-head",children:[R.jsx("span",{className:"mp-item-type",style:{background:"rgba(0,212,170,0.1)",color:"#00d4aa",border:"1px solid rgba(0,212,170,0.3)"},children:"note"}),R.jsx("button",{className:"mp-item-del",onClick:()=>b(H=>H.filter(P=>P.id!==C.id)),children:"✕"})]}),R.jsxs("div",{className:"mp-item-val",style:{fontSize:11,color:C.color,cursor:"pointer"},onClick:()=>{je(C.id),k(C.text),G(C.point),ye(C.color)},children:[C.text.slice(0,40),C.text.length>40?"…":""]})]},C.id))]})]}),(xe||rt)&&R.jsxs("div",{className:"annot-dialog",children:[R.jsxs("div",{className:"ad-title",children:["🏷 ",rt?"Edit annotation":"Add annotation"]}),R.jsx("div",{className:"ad-colors",children:jd.map(C=>R.jsx("button",{className:`ad-color-btn ${te===C?"active":""}`,style:{background:C},onClick:()=>ye(C)},C))}),R.jsx("textarea",{className:"ad-textarea",placeholder:"Type your note…",value:_t,autoFocus:!0,style:{color:te},onChange:C=>k(C.target.value),onKeyDown:C=>{C.key==="Enter"&&!C.shiftKey&&(C.preventDefault(),em()),C.key==="Escape"&&(G(null),je(null))}}),R.jsxs("div",{className:"ad-row",children:[R.jsx("button",{className:"ad-cancel",onClick:()=>{G(null),je(null)},children:"Cancel"}),R.jsx("button",{className:"ad-save",onClick:em,children:"Save"})]})]}),(()=>{const C=()=>fi(!1),H=(P,J,ne)=>Je(me=>me.map(Ie=>Ie.id===P?{...Ie,title:J,comment:ne}:Ie));return R.jsx("div",{className:`media-backdrop${es?" open":""}`,onClick:C,children:R.jsxs("div",{className:"media-modal",onClick:P=>P.stopPropagation(),children:[R.jsxs("div",{className:"mm-header",children:[Qn?R.jsxs("div",{className:"mm-title-wrap",children:[R.jsx("div",{className:"mm-title-label",children:"📍 Point"}),R.jsx("input",{className:"mm-title-input",placeholder:"Point title…",value:Zo,onChange:P=>xr(P.target.value),onBlur:()=>H(Qn,Zo,Jo),onKeyDown:P=>{P.key==="Enter"&&P.target.blur(),P.key==="Escape"&&(P.stopPropagation(),C())}}),R.jsx("textarea",{className:"mm-comment-field",placeholder:"Add a comment or description…",rows:2,value:Jo,onChange:P=>E(P.target.value),onBlur:()=>H(Qn,Zo,Jo),onKeyDown:P=>P.stopPropagation()})]}):R.jsxs("div",{className:"mm-title-wrap",children:[R.jsx("div",{className:"mm-title-label",children:"📸 Gallery"}),R.jsx("div",{style:{fontSize:15,fontWeight:700,color:"#e8e8f0"},children:"All Media Points"})]}),R.jsx("button",{className:"mm-close",onClick:C,children:"✕"})]}),R.jsxs("div",{className:"mm-tabs",children:[Qn&&R.jsxs(R.Fragment,{children:[R.jsxs("button",{className:`mm-tab${Pi==="images"?" active":""}`,onClick:()=>Nn("images"),children:["📷 Images",(()=>{var J;const P=((J=ue.find(ne=>ne.id===Qn))==null?void 0:J.items.filter(ne=>ne.type==="image").length)??0;return P?` (${P})`:""})()]}),R.jsxs("button",{className:`mm-tab${Pi==="videos"?" active":""}`,onClick:()=>Nn("videos"),children:["🎬 Videos",(()=>{var J;const P=((J=ue.find(ne=>ne.id===Qn))==null?void 0:J.items.filter(ne=>ne.type==="video").length)??0;return P?` (${P})`:""})()]})]}),R.jsxs("button",{className:`mm-tab tab-all${Pi==="all"?" active":""}`,onClick:()=>Nn("all"),children:["🗂 All Points",ue.length?` (${ue.length})`:""]})]}),R.jsxs("div",{className:"mm-body",children:[Qn&&Pi!=="all"&&(()=>{const P=ue.find(me=>me.id===Qn);if(!P)return null;const J=Pi==="images",ne=P.items.filter(me=>me.type===(J?"image":"video"));return R.jsxs(R.Fragment,{children:[R.jsxs("div",{className:"mm-upload",children:[R.jsxs("div",{className:"mm-upload-row",children:[R.jsx("input",{className:"mm-title-field",placeholder:`Title for this ${J?"image":"video"}…`,value:O,onChange:me=>V(me.target.value),onKeyDown:me=>me.stopPropagation()}),R.jsxs("label",{className:"mm-upload-btn",style:{cursor:Us?"default":"pointer",display:"inline-flex",alignItems:"center",gap:6},children:[Us?"⏳ Uploading…":`＋ ${J?"Image":"Video"}`,R.jsx("input",{type:"file",accept:J?"image/*":"video/*",style:{display:"none"},disabled:Us,onChange:async me=>{var Ee;const Ie=(Ee=me.target.files)==null?void 0:Ee[0];Ie&&(await dy(Ie,O,P.id),me.target.value="")}})]})]}),R.jsxs("div",{className:"mm-hint",children:[J?"JPEG · PNG · WebP · GIF":"MP4 · WebM · MOV"," · Title optional"]})]}),ne.length===0?R.jsxs("div",{className:"mm-empty",children:[R.jsx("div",{className:"mm-empty-icon",children:J?"🖼":"🎬"}),R.jsxs("div",{children:["No ",Pi," added yet.",R.jsx("br",{}),"Upload one above."]})]}):R.jsx("div",{className:"mm-grid",children:ne.map(me=>R.jsxs("div",{className:"mm-card",children:[me.type==="image"?R.jsx("img",{src:me.url,alt:me.title,decoding:"async",loading:"lazy",onClick:()=>F(me)}):R.jsx("video",{src:me.url,controls:!0,preload:"metadata",onClick:Ie=>Ie.stopPropagation()}),R.jsx("div",{className:"mm-card-info",children:R.jsx("div",{className:"mm-card-title",title:me.title,children:me.title})}),R.jsx("button",{className:"mm-card-expand",title:"Fullscreen",onClick:()=>F(me),children:"⤢"}),R.jsx("button",{className:"mm-card-dl",title:"Download",onClick:()=>Nu(me),children:"↓"}),R.jsx("button",{className:"mm-card-del",onClick:()=>Je(Ie=>Ie.map(Ee=>Ee.id===P.id?{...Ee,items:Ee.items.filter(Te=>Te.id!==me.id)}:Ee)),children:"✕"})]},me.id))})]})})(),Pi==="all"&&(ue.length===0?R.jsxs("div",{className:"mm-empty",children:[R.jsx("div",{className:"mm-empty-icon",children:"📍"}),R.jsxs("div",{children:["No media points yet.",R.jsx("br",{}),"Click ",R.jsx("strong",{children:"📸 Media"})," in the toolbar below, then click the model to place a point."]})]}):ue.map(P=>R.jsxs("div",{className:"mm-point-section",children:[R.jsxs("div",{className:"mm-point-header",children:[R.jsx("div",{className:"mm-point-dot"}),R.jsx("div",{className:"mm-point-name",children:P.title||"(Untitled point)"}),R.jsxs("div",{className:"mm-point-cnt",children:[P.items.length," item",P.items.length!==1?"s":""]}),R.jsx("button",{className:"mm-open-btn",onClick:()=>uy(P),children:"Open →"}),R.jsx("button",{className:"mm-del-pt",onClick:()=>{Je(J=>J.filter(ne=>ne.id!==P.id)),Qn===P.id&&ei(null)},children:"Delete"})]}),P.comment&&R.jsx("div",{className:"mm-point-comment",children:P.comment}),P.items.length>0&&R.jsx("div",{className:"mm-grid",children:P.items.map(J=>R.jsxs("div",{className:"mm-card",children:[J.type==="image"?R.jsx("img",{src:J.url,alt:J.title,decoding:"async",loading:"lazy",onClick:()=>F(J)}):R.jsx("video",{src:J.url,controls:!0,preload:"metadata",onClick:ne=>ne.stopPropagation()}),R.jsx("div",{className:"mm-card-info",children:R.jsx("div",{className:"mm-card-title",title:J.title,children:J.title})}),R.jsx("button",{className:"mm-card-expand",title:"Fullscreen",onClick:()=>F(J),children:"⤢"}),R.jsx("button",{className:"mm-card-dl",title:"Download",onClick:()=>Nu(J),children:"↓"})]},J.id))})]},P.id)))]})]})})})(),R.jsxs("div",{className:`lightbox${z?" open":""}`,onClick:()=>F(null),children:[z&&R.jsx("div",{className:"lightbox-media-wrap",onClick:C=>C.stopPropagation(),children:z.type==="image"?R.jsx("img",{src:z.url,alt:z.title,decoding:"async"}):R.jsx("video",{src:z.url,controls:!0,autoPlay:!0,onClick:C=>C.stopPropagation()})}),R.jsx("button",{className:"lightbox-close",onClick:()=>F(null),children:"✕"}),z&&R.jsx("button",{className:"lightbox-dl",onClick:()=>z&&Nu(z),title:"Download",children:"↓"}),(z==null?void 0:z.title)&&R.jsx("div",{className:"lightbox-caption",children:z.title})]}),ve&&R.jsx("div",{className:"home-toast",children:"📍 Auto-Home position saved for this map"}),ce&&R.jsx("div",{className:"screenshot-toast",children:"📷 High-Res Screenshot saved!"}),Q&&w===100&&!we&&R.jsx("div",{className:"stats-panel",children:[{val:Q.fileName.length>16?Q.fileName.slice(0,14)+"…":Q.fileName,lbl:"File"},{val:ya(Q.fileSize),lbl:"Size"},{val:K2(Q.loadTime),lbl:"Load time"},{val:Q.triangles.toLocaleString(),lbl:"Triangles"},{val:Q.meshes.toString(),lbl:"Meshes"},{val:Q.textures.toString(),lbl:"Textures"}].map((C,H,P)=>R.jsxs("span",{style:{display:"contents"},children:[R.jsxs("div",{className:"stat-item",children:[R.jsx("div",{className:"stat-val",children:C.val}),R.jsx("div",{className:"stat-lbl",children:C.lbl})]}),H<P.length-1&&R.jsx("div",{className:"stat-div"})]},C.lbl))}),fe&&R.jsx("div",{className:"help-backdrop",onClick:()=>Oe(!1),children:R.jsxs("div",{className:"help-panel",onClick:C=>C.stopPropagation(),children:[R.jsxs("div",{className:"help-header",children:[R.jsxs("div",{className:"help-title",children:[R.jsx("div",{className:"help-title-icon",children:"?"}),"Controls & Shortcuts"]}),R.jsx("button",{className:"help-close",onClick:()=>Oe(!1),children:"✕"})]}),R.jsxs("div",{className:"help-body",children:[R.jsxs("div",{className:"callout",children:["✅  ",R.jsx("strong",{children:"Unlit mode = Metashape-accurate colours"}),R.jsx("br",{}),"Photogrammetry textures have real-world lighting baked in. Unlit mode skips PBR shading → raw captured colour."]}),R.jsxs("div",{className:"help-section",children:[R.jsx("div",{className:"help-section-label",children:"🖱 Mouse"}),R.jsx("div",{className:"help-grid",children:[{keys:["Left drag"],desc:"Orbit"},{keys:["Right drag"],desc:"Pan"},{keys:["Scroll"],desc:"Zoom"},{keys:["Middle drag"],desc:"Pan (alt)"}].map(C=>R.jsxs("div",{className:"help-row",children:[R.jsx("div",{className:"help-keys",children:C.keys.map(H=>R.jsx("span",{className:"kbd",children:H},H))}),R.jsx("div",{className:"help-desc",children:C.desc})]},C.desc))})]}),R.jsx("div",{className:"help-divider"}),R.jsxs("div",{className:"help-section",children:[R.jsx("div",{className:"help-section-label",children:"⌨️ Fly navigation"}),R.jsx("div",{className:"help-grid",children:[{keys:["W","↑"],desc:"Walk forward"},{keys:["S","↓"],desc:"Walk backward"},{keys:["A","←"],desc:"Strafe left"},{keys:["D","→"],desc:"Strafe right"},{keys:["E"],desc:"Fly up"},{keys:["Q","F"],desc:"Fly down"},{keys:["Shift"],desc:"4× speed boost (hold)"},{keys:["Space"],desc:"Immediate stop"},{keys:["‹ btn"],desc:"Camera history back"},{keys:["› btn"],desc:"Camera history forward"}].map(C=>R.jsxs("div",{className:"help-row",children:[R.jsx("div",{className:"help-keys",children:C.keys.map(H=>R.jsx("span",{className:"kbd",children:H},H))}),R.jsx("div",{className:"help-desc",children:C.desc})]},C.desc))})]}),R.jsx("div",{className:"help-divider"}),R.jsxs("div",{className:"help-section",children:[R.jsx("div",{className:"help-section-label",children:"📐 Measuring"}),R.jsx("div",{className:"help-grid",children:[{keys:["Click"],desc:"Place measurement point"},{keys:["Right-click"],desc:"Finish/Complete measurement"},{keys:["Esc"],desc:"Cancel current measurement"},{keys:["👁️ btn"],desc:"Cycle UI view visibility"},{keys:["📷 btn"],desc:"Screenshot + download PNG"},{keys:["📐 btn"],desc:"Open measurements panel"}].map(C=>R.jsxs("div",{className:"help-row",children:[R.jsx("div",{className:"help-keys",children:C.keys.map(H=>R.jsx("span",{className:"kbd",children:H},H))}),R.jsx("div",{className:"help-desc",children:C.desc})]},C.desc))})]}),R.jsxs("div",{className:"help-tip",children:["🔍 All measurements persist in your browser across sessions.",R.jsx("br",{}),"📍 ",R.jsx("strong",{children:"Smart Auto-Home:"})," When you save your home view, it's bound to that specific file name. Dropping the same map later instantly snaps to your saved angle.",R.jsx("br",{}),"📷 Screenshot composites the 3D view + all overlays into one High-Res PNG."]})]})]})})]})]})]})}const iy=document.getElementById("root");if(!iy)throw new Error("Root element #root not found in DOM.");Kd.createRoot(iy).render(R.jsx(Ly.StrictMode,{children:R.jsx(Q2,{})}));
