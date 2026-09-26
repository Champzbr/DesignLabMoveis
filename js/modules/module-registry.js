// DesignLabMoveis 1.311.00 · registry explícito para dependências funcionais circulares.
// Estado mutável do editor NÃO pertence aqui; ele vive em runtimeModel.
export function createModuleRegistry(){
  const modules=new Map();

  function register(name,api){
    if(!name||typeof name!=='string')throw new TypeError('moduleRegistry.register: nome inválido');
    if(!api||typeof api!=='object')throw new TypeError(`moduleRegistry.register(${name}): API inválida`);
    if(modules.has(name))throw new Error(`moduleRegistry: módulo já registrado: ${name}`);
    modules.set(name,api);
    return api;
  }

  function has(name){return modules.has(name);}
  function get(name){return modules.get(name)||null;}
  function requireModule(name){
    const api=modules.get(name);
    if(!api)throw new Error(`moduleRegistry: módulo ainda não registrado: ${name}`);
    return api;
  }
  function requireMethod(name,method){
    const api=requireModule(name),fn=api?.[method];
    if(typeof fn!=='function')throw new Error(`moduleRegistry: ${name}.${method} não está disponível`);
    return fn;
  }
  function call(name,method,...args){
    return requireMethod(name,method)(...args);
  }
  // Compatibilidade explícita para ciclos que podem ser consultados durante o bootstrap.
  // Diferente do antigo ?.(), a dependência fica centralizada e pesquisável.
  function callIfReady(name,method,...args){
    const api=modules.get(name),fn=api?.[method];
    return typeof fn==='function'?fn(...args):undefined;
  }
  function callOr(fallback,name,method,...args){
    const value=callIfReady(name,method,...args);
    return value===undefined?fallback:value;
  }
  function list(){return [...modules.keys()];}

  return {register,has,get,require:requireModule,requireMethod,call,callIfReady,callOr,list};
}
