import { nothing } from "./constants.js";

                                 

                                          

/** A node of whichever host is installed; only the host reads it. */
                               

                                

/** The prototype of the global class `Name` where the host's lib declares it, unknown elsewhere. */
                                                                                                        

/** The members of the global class `Name` that `Keys` names, where the host's lib declares it; nothing elsewhere. */
                                                                                                                                                           

/** The browser's Element where the DOM lib is present, unknown elsewhere. */
                                               

/** The browser's EventTarget where present, unknown elsewhere. */
                                                       

/** The browser's Event where present, unknown elsewhere. */
                                           

/**
 * An event target read through a template handler: an element with a form
 * control's state and methods, since the control a binding sits on is not
 * knowable from the template. Any other member reads as unknown and is
 * narrowed before use.
 */
                                             
               
                                                                                                                  
                          

/**
 * The event a template handler receives: an Event whose `target` and
 * `currentTarget` are present, with the key, pointer, drag and input fields
 * the common DOM events carry; any other member reads as unknown. The
 * concrete DOM event type is not knowable from the template, so a handler
 * that needs it annotates its own parameter.
 */
                                      
                                                           
                                                                                                                       
                                                                                                                               
                                        
                                               
                          

/** Method-style so the parameter compares bivariantly: a handler may declare the concrete DOM event its binding delivers. */
                            
                                       
 

/**
 * A function placed in a template is typed as a handler.
 * `@click=${(e) => e.preventDefault()}` sees the event's members,
 * `e.target.value` reads without a cast, a `.prop=${(info) => ...}`
 * callback receiving another shape still reads its fields, and a handler
 * that annotates its parameter with the concrete DOM event keeps that type.
 */
                                                         

/** Anything a template renders as a child. Every JS value except a bare `unknown` fits, so this is what a render helper returns. */
                                                                                                 

/** What a template value may be; only functions are narrowed, the rest is left open. */
                                                         

                                                                              
/** @deprecated use Keyed */
                                                  
/** @deprecated use Unsafe */
                                                      

/** Where `render` puts its root part: an element of the installed host. */
                                      

                                
                
                           
                                                                                                                
                                  
 

                               
                  
 

                                                             

                                                 

                                                                                         

                             
                 
                     
                     
                
                     
                 
                    
 

                                              
                    
 

                              
                 
                      
 

                                                         
                                         
  

                                                            

export * from "./core.js";
