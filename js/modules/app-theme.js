// DesignLabMoveis 1.311.00 · aparência global do aplicativo.
export function createAppThemeModule({toast}){
  const THEME_KEY='designLabAppThemeV2';
  const USER_CHOICE_KEY='designLabAppThemeUserChoiceV2';
  let theme='light';
  try{
    const explicit=localStorage.getItem(USER_CHOICE_KEY);
    theme=explicit==='dark'?'dark':'light';
    localStorage.setItem(THEME_KEY,theme);
  }catch{}

  function syncButtons(){
    document.querySelectorAll('[data-app-theme-choice]').forEach(btn=>{
      btn.classList.toggle('active',btn.dataset.appThemeChoice===theme);
      btn.setAttribute('aria-pressed',btn.dataset.appThemeChoice===theme?'true':'false');
    });
  }

  function apply(next,{persist=true,notify=false}={}){
    theme=next==='dark'?'dark':'light';
    document.documentElement.dataset.appTheme=theme;
    document.body.dataset.appTheme=theme;
    document.documentElement.classList.toggle('designlab-dark-enabled',theme==='dark');
    document.documentElement.classList.toggle('designlab-light-default',theme!=='dark');

    const light=theme==='light';
    document.documentElement.style.colorScheme=light?'only light':'light';
    document.body.style.colorScheme=light?'only light':'light';
    document.documentElement.style.backgroundColor=light?'#f4f7f9':'#171717';
    document.body.style.backgroundColor=light?'#f4f7f9':'#171717';
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',light?'#f4f7f9':'#06151e');
    const schemeMeta=document.querySelector('meta[name="color-scheme"]');
    if(schemeMeta)schemeMeta.setAttribute('content',light?'only light':'light');
    const supported=document.querySelector('meta[name="supported-color-schemes"]');
    if(supported)supported.setAttribute('content','light');
    syncButtons();
    if(persist){
      try{localStorage.setItem(THEME_KEY,theme);localStorage.setItem(USER_CHOICE_KEY,theme);}catch{}
    }
    if(notify)toast?.(theme==='dark'?'Modo escuro ativado':'Layout clássico claro ativado');
    return theme;
  }

  apply(theme,{persist:false,notify:false});
  return {syncDesignLabThemeButtons:syncButtons,applyDesignLabAppTheme:apply,getTheme:()=>theme};
}
