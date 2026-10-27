                                                  

/**
 * An element whose templates project its light children into the `<slot>`
 * elements they render: it registers every slot part cloned under it and
 * runs projection once the clone is in the tree.
 */
                                           
                                                                                    
                                                        
                          
                                                                                                    
                             
                        
 

/** What a host hands `projectSlots` to be told which nodes to watch and which slot names it lacks. */
                               
                               
                               
                              
 

/** One thing a served host projected, as its parent's walker sees it: a child-part range or an element, with the slot it sits in (null for the light area). */
                           
                                                                                      
                                                                  

/** Re-export the runtime so `@bootstrapp/light/dom` surfaces the browser View and the host beside these declarations. */
export * from "./index.js";
export { default } from "./index.js";
