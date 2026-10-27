/**
 * @lightstart/light/types: the property descriptor `T` builds, the shorthand
 * a `props` block may use in its place, and what validation answers.
 */

/** Result of validating a single value against a descriptor. */
                                   
                 
                                                
                 
                                                               
                       
                                
                   
 

/** What the validators answer: `[errorCode, valueOrDetails]`, or nothing when valid. */
                                                                                     

/** A check that runs before the built-in validation; a truthy answer fails with it. */
                               
                 
                       
                   
                     

/**
 * The fields of a descriptor. The view engine reads `$type` through
 * `hasChanged`; a model reads the rest. Different factories fill different
 * subsets; an extension registered with `T.registerTypes` adds its own
 * through the index signature of `TypeDefinition`.
 */
                                       
                                                                                                   
                
                                                                                                              
                     
                                                                                                   
                     
                         
                                                                                                       
                                              
                                                                                                                             
                                                                  
                         
                                    
                                                                 
                                                                                                                               
                   
                     
                  
                                                                                                                 
                   
                      
                               
                           
                                                           
               
               
                           
                          
                                  
                                                             
                                  
                            
                 
                    
                        
                  
                     
                                    
                 
                                                                                                                                       
               
                                                                                                                                        
                 
                 
                      
                   
                   
                  
                   
                           
                            
                          
                           
                                                               
 

/**
 * The phantom `T` never exists at runtime: it carries the type a property
 * declared with this descriptor holds, so `defineComponent` can type `this`
 * from a `props: { x: T.string() }` block. A factory answers
 * `TypeDefinition<never>`, which fits every slot, and the slot that holds it
 * names the type: `TypesAPI.string` reads `TypeDefinition<string>` with the
 * `required` and `defaultValue` it was given in a second phantom
 * (`DeclaredTypeDefinition`), so `T` is declared with its type instead of
 * cast to it.
 */
                                                                                            
                        
  

/**
 * A default standing in for a descriptor: `count: 0` is `T.number(0)`,
 * `label: "x"` is `T.string("x")`, `open: false` is `T.boolean(false)`,
 * `items: []` is `T.array({ defaultValue: [] })`, an object is
 * `T.object({ defaultValue })`, `null` is `T.any({ defaultValue: null })`.
 * Any object counts, so a default cast to an interface type is one too.
 */
                                                                                      

/** What a `props` entry may be: a descriptor, or a default the engine reads one off. */
                                                                     

/** A definition's `props` block as the author writes it: descriptors, or defaults standing in for them. */
                                                                       

/**
 * Map a `props: { x: T.string(), count: 0 }` block into the TS shape
 * that ends up on `this` inside `render()` / lifecycle hooks (`this.x: string`,
 * `this.count: number`); see `PropertyValue`.
 */
                              
                                      
  

/** Whether `V` is a union of more than one member (`boolean` counts). */
                                                                                      

/**
 * The value type a `props` entry declares: a descriptor's phantom type; for a
 * default, its widened type (`false` is `boolean`, `0` is `number`, `""` is
 * `string`), an empty array literal as `unknown[]`, `null` as `any`. A default
 * cast to a type keeps it whole: a `null` cast to `User | null` is
 * `User | null`, and a string cast to `"a" | "b"` stays that union. A
 * declaration not yet decided (the whole `PropertyDeclaration` union, as a
 * generic signature carries it) is `any`.
 */
                                                                          
                                             
                                            
                                              
                               
                                   
                                 
                                 
      

                                                                                                              

/** An options object, or a bare default: `T.string("hi")` is `T.string({ defaultValue: "hi" })`, `T.array([])` a default too. */
                                                                                                                   

                                                                        

/** An extension for `T.registerTypes`: a custom name mapped to the factory of its descriptor's fields. */
                                
                                                           
 

/** A bare default as the `defaultValue` it stands for, or the `required` and `defaultValue` of an options object. */
                                                
                                                                                                      
                                                           

/** What a primitive factory's descriptor carries from its options, in its type: the `required` and `defaultValue` written there, which a model's `RowOf` reads. */
                                                                 

/**
 * A primitive factory's descriptor: the value's type and, in the phantom
 * `__tsHeld` that never exists at runtime, the options it was declared with.
 */
                                                                                                          

                                                                                                                             
                           
                                 
                                                   
                        
                       

                           
                        
                          
                          
                            
                        
                            
                            
                                           
                                                                                       
                                                                                                                                                  
                               
                                  
                                   
                                          
                                                                    
                                                             
                                                                  
                                                                            
                                                        
               
                                    
              
                                             
                                    
                               
                                
                                
      
                                                                     
                                                
                         
 

export * from "./index.js";
export { default } from "./index.js";
