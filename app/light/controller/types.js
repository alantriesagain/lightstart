/**
 * @lightstart/light/controller: type declarations.
 */

                                                                                                
                                                  
                                                         
                                                                       
                                                                

                                                                                 
                                                                                                                            
                                                     

/**
 * A controller definition: a component definition minus `render`. Same
 * vocabulary as views (`props` as shorthand defaults or descriptors,
 * `connected`/`disconnected`) plus a `sync` block and object-literal members.
 */
                                    
               
                               
                                                      
                                                
                                                                                            
                                         
                                         
                                            
                                                                

/**
 * The members every instance carries. All of them start with `$`, so every
 * other name is free for a declared property or member; the definition's
 * `connected`/`disconnected` hooks stay in the definition and never sit on the
 * instance.
 */
                                     
                
                                                                                                                      
                      
                   
                                                                                                                           
                                                                
                                                                             
                                                           
                                                                                                                      
                                                                                                
                                                                                                                                                                  
                        
                                                                                                                                                     
                                   
                                                
                         
 

/** The definition keys `defineController` keeps to itself; everything else lands on the instance. */
                                                                                                          

/**
 * Targets a host teaches the binding (through `registerSyncBinder`), added by
 * declaration merging: `declare module "@lightstart/light/controller" { interface SyncTargets { model: ModelApi } }`.
 */
                               

/**
 * What a property binds to: an adapter or controller name (`"local"`,
 * `"ledger"`), anything carrying a `$sync` (a store, a signal, a controller),
 * a target a host taught the binding, or a thunk answering one when the
 * property binds.
 */
                                                                                                                 

/** A sync entry's query as a function of the host. Method-style, so a function typed for its own host is accepted. */
                       
                               
 

/** The long form of a sync entry, for a target that needs more than its name. */
                            
                 
                                                                                                
               
                                                                                                             
                 
                                                                                                        
                                        
                                                    
                       
 

/** A definition's `sync` block: one entry per bound property, keyed by the property's name. */
                                                                       

/**
 * A controller, as `defineController` answers it: the instance's props and
 * members, reached through a handle that builds the instance on first reach.
 * `definition`, `has()` and `dispose()` answer from the handle; `$ready` waits
 * for a teardown in progress and then for the instance built after it.
 */
                                                                                                    
                                                                                             
                                                             
                                                                            
                   
                                                                                                                                                                          
                                    
    

/** `ControllerInstance` without its index signature, so `Omit` keeps the named members. */
                          
                                                                                         
  

/**
 * A property's descriptor as the binding reads it: the sync options folded in
 * from the block, the default and the (de)serialization a controller's store
 * takes, and every other key the descriptor carries.
 */
                           
                 
                         
                     
                 
               
                 
                  
                       
                                     
                                        
                            
 

/** What binding one property answers: the unbind, and the first value's arrival when it comes later. */
                          
                     
                         
 

/** What a binding reads its scope from and a binder keeps its queries on: the controller instance or the element. */
                                               

/** A data source the binding cannot follow as an adapter, a store or a signal; see `registerSyncBinder`. */
                             
                                                    
                                 
                                                            
                                                                                                          
                                                                       
                              
 

/** The bus a resource's `invalidateOn` listens on. */
                           
                                                                 
 

/** What controllers read from their host; see `configureControllers`. */
                                   
                                                             
                                                
                                                          
                                            
                                           
                          
 

                          
                 
                                                               
          

                              
               
                            
                                            
                               
                            
                   
                                      
 

                                              
                                                    
                                               
                                                                          
                                     
                                                               
                                                 
                                         
 

/** What a storage adapter reads and writes: the browser's `localStorage` and `sessionStorage` are two. */
                              
                                      
                                            
                                
 

/** What a document adapter persists to: one JSON object, read once on attach, written whole on every change. */
                                  
                                                              
                                                            
                          
 

                                                  
                                                  
                          
 

                          
                   
                            
                                            
                                                                                            
 

/** What `adapterFor` wraps: a controller instance or a store through its `$sync`, or a `$sync` object itself. */
                              
                   
                             
                                             
                                                                                             
                  
                                     
                        
 

                           
                  
                          
 

                                                      
                                                         

                                  
                
                  
                                                                                                        
                                                       
                                                                    
                           
                                   
                                                                                                                                                                           
                                                       
     
                                                                             
                                                                               
                                            
     
                               
 

/** A resource whatever its value's type: what `dependsOn` waits on and what a host's `$queries` holds. */
                                 
               
                                                                                                 
                           
                         
                             
                              
                     
                  
                  
 

                              
               
                               
                           
                         
                       
                        
                     
                                                    
                        
                                                            
                                                          
                                  
                  
 

/** `keyedResource()` options: a resource's, with a `filter` that also hears the entry's key. */
                                                                               
                                                      
 

/** One lazily-created `Resource<T>` per key. `invalidate(key)` drops the entry. */
                                   
                                
                                
                        
                   
                  
 

export * from "./index.js";
