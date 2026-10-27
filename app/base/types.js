/**
 * @bootstrapp/base: the kernel's contracts. `BootstrappApp` is the `$APP`
 * that `base/app.js` builds; areas and packages augment it with the slots
 * they register (`declare module "bootstrapp/base" { interface BootstrappApp { X: ... } }`).
 * `Manifest` is what the kernel loads and the manifest generator merges.
 */

                                                            

                                
                                                                                        
                                   
                                                                 
                                                              
                  
                       
                                                                                                                             
                                                                                  
 

/** Something that can apply a pending update in place of the service worker (a native shell's OTA). */
                                
             
                                                                                           
                   
 

/** `$APP.updates` (base/update-policy.js): how an available update gets applied. */
                               
                 
                     
                
                                                                                           
                                              
                          
 

/** `/content/manifest.json`: the bundle version plus a version hash per content collection. */
                                  
                       
                                              
 

/** Options accepted by `createContentSync` (packages/base/content-sync.js). */
/** Reads content through a durable byte cache, or straight from the network when there is none. */
                                
                                                      
                                                                                                              
                                          
                                                                                               
                                                        
                                                                                                                                
                                                    
 

/** A durable byte store behind the content reader: the Cache API where usable, IndexedDB otherwise. */
                                    
               
                          
                                                                       
                                                                                 
                                     
                                            
 

                                     
                     
                       
                  
                         
                                                                  
                                                              
                                                                                         
                                                  
                                            
                                          
 

/**
 * Which runtime the current global lives in. Set once at module load
 * by `packages/base/app.js` via `globalThis` shape detection.
 */
                                                                  

/**
 * An app profile: one deployed build can serve several apps, each with
 * its own branding, theme, shell layout, and extension set. Profiles
 * ship as `/apps/<name>.json`; `resolveAppProfile` merges the one
 * matching the current hostname (or `?app=` override) onto the manifest
 * before `bootstrap()`.
 *
 * `theme` and `settings` deep-merge onto their manifest blocks rather than
 * replacing them, so a profile states only its differences. Every other key is
 * carried across untyped on `manifest.app`: a package that gives a profile a
 * block of its own reads it from there and types it by augmenting this
 * interface, which is how the core stays unaware of what packages exist.
 */
                             
               
                 
                                                                 
                   
                                                               
                                                                                         
              
                        
                         
                         
                     
                                                          
                        
                           
    
                                  
                                     
                         
                                                                                    
                                 
     
                                                                        
                                                                                   
     
                  
     
                                                                          
                                                                              
                                        
     
                      
     
                                                                        
                                                                         
                                                         
     
                     
                                                                                       
                                                                                   
                                                   
                                            
                                                                       
                                   
                         
 

/** One `@bootstrapp/<name>` package record in `manifest.packages`. */
                                
                                                                                          
                
                                                               
                      
                    
                           
                                                                                   
                     
                      
                         
                        
 

/** What only the development server serves: dev scripts, and the importmap and vendor entries of dev tooling packages. */
                              
                     
                                     
                                  
                
                         
 

/**
 * The resolved manifest. The shape grows organically; feature packages
 * contribute via `package.json → bootstrapp.*` and the manifest
 * generator merges them in. Index signature keeps unknown keys typed
 * as `unknown` rather than `any`.
 */
/** One `manifest.extensions.<host>.<id>` record: the entry module per runtime, and how the boot treats it. */
                                         
                       
                      
                 
                                                                      
                 
                                                                                            
                
                         
 

                           
                       
                                                                                           
                
                      
                       
                                                                                                          
               
                                                        
                    
                                                                                                                          
                             
                                           
                                                                                   
                   
                    
                   
                                                                                                                                             
                                     
                                  
                                                                                                    
                   
                       
                       
                  
                     
                                                                                        
                                                        
                                                                                                          
                  
                                                                                                                                                                     
                                                                                                                                                                        
                   
                                                                          
                                                                  
                                                         
                                                                                     
                                                                               
                                                                          
                                                           
                                                             
                                                      
                                                                          
                         
          
                           
                        
                                                                                                            
                            
                       
                      
                                                                     
                            
                           
                           
    
                                                                                                              
            
                                                                                    
                        
                                                                                                    
                               
                                                                                
                         
                        
                    
    
                                                                             
                                   
                                                                                              
                                                                                         
                                                               
                         
 

/**
 * Merged database bootstrap config: the manifest's `database` block, whole,
 * plus any `$APP.databaseConfig` project overrides. Built by `backend.js`
 * `App.bootstrap()` and stored back on `$APP.databaseConfig`; `version`
 * and mutated `name` are stamped from the active system App record. An
 * adapter package declares the keys it reads by augmenting this interface.
 */
                                     
                  
                                                                                                                                      
                         
               
                                                  
               
                  
                                                     
                           
                            
                         
 

/** Map of event-name → handler wired by `addModule`; handlers take `(data)`. */
                                                                           

/**
 * A record registered on `$APP` via `addModule`: a name, the library
 * object exposed as `$APP[name]`, and optional metadata. Runtime
 * lifecycle lives on the app host's extension records, not here.
 */
                                   
                                                          
               
                                                                                                
                        
                                                          
                                     
                                                                                         
                 
                                                                                
                
                                                                      
                 
     
                                                                 
                                                                      
                                           
     
          
                      
                                                                              
                                                               
                  
 

/**
 * `this` inside a module entry's `connected()`: the app host binds `$host`
 * onto the registered module before the hook runs.
 */
                                                                        

/**
 * Optional initFn passed to `$APP.load()`: runs inside `bootstrap()`
 * after schemas load and module discovery.
 */
                                                      

/**
 * The `$APP` global. Kernel surface is small: the registry/lifecycle
 * primitives only. Everything else (`Model`, `View`, `routes`,
 * `theme`, etc.) lands here at runtime via `addModule` / module setup
 * and is reached through the index signature.
 */
                                
                                
                                                                                                                   
                              
                     
                                                                                                                                                                                                       
                                       
                             
                                                              
                                         

                                                                                
                       
                      
                         
                    
                             

     
                                                                      
                                                                     
                                                
     
                                               

                                                                                       
                                         
                                                                                                         
                                                  
                                                                                 
                                                                        
                                                                                           
                                 
                                         
                                                     
                                                                   
                  

          
                                      
                         
    
                                                                                          
                                     
                                                                                          
                        
                                                                                        
                        
                                                                                           
                                                                                                    
                                                
                                                                                                                 
                                                                                                        
                                                            
                                                                                                                                                                                                   
                                      
 

/** One module that failed: a controller or route the project entry could not import, or a component (`kind: "component"`, `url` its tag) whose definition the loader rejected. */
                                     
               
              
                
 

/** A dev-server message: JSON carrying a `type`, plus whatever the sender attached. */
                                   
               
                                                                                
                
                         
 

/** `window.__devClient` (framework/base/dev-client.js): the dev-server message handler registry. */
                                    
                                                            
                                                                      
                          
                             
 

/** Runtime globals the kernel sets. */
                
                          
                                            
                                                                                                    
                                                    
                                                                                                                                                                       
                                                                                  
                                                                                                          
                                                
                                                                                                                        
                                                    
                                                                                
                                        
                                                                   
                                                                                                                  
                                                     
                                                                                    
                                           
     
                                                                           
                                                                                 
                                                                         
                               
     
                    
                         
                                                                                                            
                                    
                                                                    
                            
   
 

/** A baked file model's compact index: the fields it carries, its facets, its search blob and the orderable fields it computes. */
                                  
                   
                    
                    
                                                                      
 

                                          
                                   
                                                                                     
                    
                                                                                                                                                              
                          
                                                                                                             
                                 
                                                         
                        
   
 
