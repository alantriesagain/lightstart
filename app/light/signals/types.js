                                                

/** One declared state field: a default plus optional (de)serialization. */
                           
                    
                                     
                                        
 

                            
                  
                            
                                            
                                                                                            
 

/**
 * A declared store as its runtime value: the declared keys read and written
 * through `get` and `set`, one signature per member. `createStore` answers
 * it. A store made with `accessors` (the default) also carries each declared
 * key as a reactive accessor; a caller that reads them declares the keys on
 * its own type (`Store & { count: number }`).
 */
                            
                   
                            
                                            
                                                                  
                              
                   
                                                                                            
                                                                                          
                                      
                                                
                   
 

/** A store typed by its declared keys `S`: what a view's or a controller's `$state` reads as. */
                                                                       
                                                
                            
                                                                
                                            
                                                                                   
                                                                  
                                                                                                             
                                                                                            
 

export * from "./index.js";
