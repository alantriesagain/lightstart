/**
 * @lightstart/light: the view engine's public type declarations.
 */

                                                                                                                
                                   

                                                                                          

/** A class's merged property descriptors, every entry normalised. */
                                                              

/**
 * What `this` is inside a definition's methods: the reactive properties, own
 * and from mixins; the sibling members declared on the same literal and on
 * the mixins (the definition keys the engine consumes never reach `this`, so
 * a property may share a hook's name); the engine's instance members; the
 * narrowed `$emit`; and, with `extends`, any other member as `unknown`, since
 * the base is known only by its tag. A `_`-prefixed member is declared like
 * any other: a field as a `props` entry (`reactive: false` for a plain
 * handle), a method as a member of the definition.
 */
                                                                                       
                                    
                   
                       
                                            
                                                                      

/**
 * The element as a render function sees it: the props, the mixins' props and
 * members, the engine's members and the narrowed `$emit`. There are no own
 * members, since a render passed as a function has no definition object.
 */
                                                            

/** A component definition as `defineComponent` and `View.define` accept it, `this` typed inside its methods. */
                                                                                                                     

/** What `View.define` answers: the class, or a promise of it when the definition `extends` a tag that may not be defined yet. */
                                                                                                                      

/** A render written as a function of the element: what `View.define(tag, props, fn)` and `View.define(tag, fn)` take. */
                                                                    

/**
 * `View.define`'s shapes. A function where a definition is expected is its
 * `render`, with `el` typed from the props beside it; inside a definition
 * object `render` is a method and reads `this`, typed like every other
 * member. (A contextual signature for a `render` member would be
 * instantiated before the literal's own members are inferred, and `this`
 * inside it would lose them.) With the props as their own argument a
 * definition may not carry `props` of its own.
 */
                         
                                                                                                        
                                                               
                                                                                                                                                                             
                
             
                                                           
                
                                                                                                                                                                                  
                
                                       
                
                                                                                                                                                                                  
                                                         
                
 

/**
 * Map an `events: { change: T.object(...) }` block into the typed `this.emit`
 * signature using a conditional type: when the literal key is in `E`, the
 * payload narrows to that event's declared shape; otherwise it stays
 * `unknown` (matching the existing loose form so undeclared events keep
 * working).
 *
 * The single signature with a conditional `payload` type forces TS to
 * narrow per-call based on the literal key, instead of falling through
 * overloads to a permissive variant.
 *
 *   events: { change: T.object(...), reset: T.any() }
 *   → this.$emit("change", payload)   // payload: Record<string,unknown>
 *   → this.$emit("change", "wrong")   // ERROR
 *   → this.$emit("undeclared", ...)   // payload: unknown (loose)
 */
                                              
         
                             
                                                        
              
                 

/** Method-style so the parameter compares bivariantly: a delegated listener may declare the DOM event it receives. */
                                      
                                 
 

/**
 * What `View.$on` calls back with: the CustomEvent's `detail`, or, for a
 * delegated `selector#eventType` subscription, the DOM `Event` itself.
 */
                                                                     

/** Method-style so the parameter compares bivariantly: a hook may declare just the part of the detail it reads. */
                                  
                                                             
 

                                                             

/** What `configureView` hands the engine. */
                             
                                                                                        
                                                
                                                             
                                                        
                                                                                    
                                               
                                                                  
                                                                                   
                                                       
               
 

                                       
                 
                             
               
                                      
 

/** What `willUpdate`, `firstUpdated` and `updated` receive: the render engine always hands them the changed props. */
                                                                 
                                     
 

/** Method-style so the parameter compares bivariantly: an update hook may declare just `{ changedProps }`. */
                               
                                                          
 

                                                       

                                   
                            
                               
                          
                            
                       
                                                         
 

                             
               
                                                                           
                  
                                                                                                      
                   
                                                                                 
                                                                                                
                            
                                                                                           
                
                      
                               
                                    
                
                             
 

                                      
               
                   
     
                                                                       
                                                                        
                                                                       
     
                                      
                               
     
                                                                         
                                                                          
                                                                          
                                                                   
                                                             
    
                
                                                   
                           
        
    
                                                                      
                                                                                    
                    
     
                            
                                                                                                                                     
                   
                           
                  
                            
                               
                          
                            
                       
                 
                
     
                                                                         
                                                          
     
                                         
                                                                                                                                              
                             
 

/**
 * The definition keys the engine consumes (`tag`, `props`, the lifecycle
 * hooks, `render`, ...). None of them lands on the element, so `this` inside
 * a definition omits them and a property may share a hook's name.
 */
                                                      

/** A definition fragment: any subset of a component definition plus members. */
                                                                                     

                                                               

                                                                                    

/** The members (methods and plain fields) every mixin in `M` contributes, minus the definition keys the view engine consumes. */
                                                                                       

                                 
                                 
                                   
                
                                                
 

/**
 * `View`'s `this.constructor` carries framework-added statics that
 * regular `Function` typing doesn't expose. `ViewConstructor` is what
 * `this.$ctor` returns.
 */
                                             
                   
                           
                  
               
                                                          
                  
                 
                        
                                                     
                                                   
  

/** Re-export runtime types from the JS entry so the bare `@lightstart/light` specifier surfaces both the type-only declarations above and the JSDoc-inferred types of runtime exports (`import type View from "/app/light/view/index.js"`). */
export * from "./index.js";
export { default } from "./index.js";
