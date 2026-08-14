import{j as t}from"./reactQuery-kqxeVfaM.js";import{a9 as o,I as r}from"./index-DD7e9XPF.js";const m=({icon:e="add",onClick:a,label:i="Quick action",colorClass:n="bg-primary-500 hover:bg-primary-600 text-white",visible:s=!0})=>s?t.jsx(o.button,{initial:{scale:0,opacity:0},animate:{scale:1,opacity:1},exit:{scale:0,opacity:0},transition:{type:"spring",stiffness:400,damping:25,delay:.1},whileTap:{scale:.9},onClick:a,className:`
        md:hidden fixed z-[45]
        w-14 h-14 min-w-[56px] min-h-[56px]
        rounded-full
        flex items-center justify-center
        fab-shadow
        touch-feedback
        ${n}
      `,style:{right:"1.25rem",bottom:"calc(5.5rem + env(safe-area-inset-bottom, 0px))"},"aria-label":i,children:t.jsx(r,{name:e,className:"text-2xl"})}):null;export{m as F};
