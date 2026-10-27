/**
 * @bootstrapp/router: public type declarations.
 *
 * .js files reference these via JSDoc imports; see
 * `feedback_types_in_dts_files` convention.
 */

// ---------------------------------------------------------------------
// Route shape
// ---------------------------------------------------------------------

                              
                                                                       
                
                                                                
                
                                                                                          
                                  
                                                                                     
                                                                                                                   
                                                              
                           
                                            
                    
                                                                                                                                                                                      
                                       
                                                                     
                                                       
                                               
                
                                                          
                
                                                                  
                  
                                                                       
                     
                                               
                         
                                                            
                              
                                                                                                                               
                                       
 

/** A page-load redirect taken while a media query matches, e.g. `{ media: "(max-width: 1023.98px)", to: "/map" }`. */
                                
                
             
 

/** A route can also be a bare render function (no metadata). */
                                                                                     

                                                   

/** The frozen product of defineRoutes(routes, defaults?): pure data the auto-loader registers. */
                                   
                    
                                                  
 

// ---------------------------------------------------------------------
// Matcher
// ---------------------------------------------------------------------

                                
                      
                     
                       
 

                               
                     
                                 
                
                                                                                                                  
                                                         
                           
                
                       
                
                                       
                                                                             
                         
                                                             
                 
 

                                  
                                          
                                      
 

// ---------------------------------------------------------------------
// Adapter: platform abstraction (browser vs memory)
// ---------------------------------------------------------------------

                                  
               
                 
                   
                 
               
 

                                
                             
                                 
                                    
                                   
                                                
                                                   
                         
                            
                                
                                                             
                                                            
 

                               
                   
                 
               
                  
 

// ---------------------------------------------------------------------
// Router core
// ---------------------------------------------------------------------

                                
                   
                    
                         
                                                                                                          
                      
                                                                                    
                     
                                           
                         
                                                                           
                      
                                                         
                                                       
 

                             
               
                                  
                
 

                                                            

                             
                      
                          
                                      
                                    
                       
                         
                         
                          
                                                                                                         
                                         
                                                                     
                                                                                           
                                                           
                                  
                                                                             
                                                                                                                    
                                                                                       
                                                                                            
                  
               
               
                                                  
                                                                                    
                                   
     
                                                                    
                                                                     
     
                                                                                             
                            
                                                
                    
                                      
                                                                               
                                                                              
                                                                                                              
                                                  
                                                                                                               
                                             
                                                                   
                                                              
                                                                                       
                        
                                                                                     
                             
                                                                                                   
                                         
                                       
                                                                            
                                                               
                                                         
 

                
                    
                              
   
 

                                                                                           

// ---------------------------------------------------------------------
// App-level wrappers
// ---------------------------------------------------------------------

                                                           
                     
                          
                           
 

                                                                 
                     
                       
                           
 

/** Re-export runtime types from the JS entry so the bare `@bootstrapp/router` specifier surfaces both the type-only declarations above AND the JSDoc-inferred types of runtime exports (so e.g. `import type View from "/app/light/view/index.js"` resolves). */
export * from "./index.js";
export { default } from "./index.js";

                                  
                           
                                                                                  
                                                
                                                                                               
   
 

                                    
                                
                                                                        
   
 
