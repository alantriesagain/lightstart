/**
 * @bootstrapp/events: public type declarations.
 *
 * .js files reference these via JSDoc imports; see
 * `feedback_types_in_dts_files` convention.
 */

/**
 * Callback signature for any event listener. Receives the emitted
 * payload (or `undefined` if `emit` was called with no data). Return
 * value is awaited by `emit`.
 *
 * Param typed `any` (not `unknown`) on purpose: handlers commonly
 * destructure shape-specific payloads (`async ({ payload, respond }) => ...`)
 * and the runtime never enforces a contract; the loose `any` matches
 * that reality. Typed declarations via `BootstrappEventMap` (per-event
 * payload shapes) layer on top through the `TypedEventCallback<K>` form,
 * which IS strict.
 */
                                                    

/**
 * Workspace-wide event-payload map. Augment via declaration merging from
 * any package that emits an event:
 *
 * ```ts
 * // packages/<pkg>/types.ts
 * declare module "bootstrapp/events" {
 *   interface BootstrappEventMap {
 *     "pages:build-end": { slug?: string; buildId?: string; error?: string };
 *     "github:sync-end": { direction?: "push" | "pull"; error?: string };
 *   }
 * }
 * ```
 *
 * Consumers then get typed payloads automatically:
 *
 * ```js
 * $APP.events.on("pages:build-end", (e) => e.slug);  // e is the typed shape
 * ```
 *
 * Keys not in the map fall through to `unknown` via the index signature.
 */
                                     
                                                                                        
                                                                  
                     
 

/** Typed callback for a specific event key. */
                                                                      
                             
             

/**
 * Flat event-name constants installed on the handler by `installEventRegistry`
 *: `$APP.events.LEDGER_TRANSACTION_SAVED` resolves to its wire string. The
 * base interface is empty; the generated `.bootstrapp/events.d.ts` augments it
 * with one `readonly CONSTANT: "domain:kebab-action"` member per registered
 * constant (collected from every package/project `events.js`). Accessing an
 * unregistered SCREAMING_SNAKE key throws at runtime (Proxy guard), so keeping
 * the type surface exact (no index signature) makes a typo a compile error too.
 */
                                     

/**
 * Pub/sub handler installed on a target by `createEventHandler`.
 *
 * `on`/`once`/`emit` are overloaded: a known `BootstrappEventMap` key
 * gives the callback a typed payload; arbitrary string keys fall back to
 * `EventCallback`.
 */
                                                         
                                                        
                                             
                                                               
                                     
                                                                        
                                                                                                       
                                                       
                                                    
                                                   
     
                                                                       
                                                                    
     
                                    
                                                      
                                                  
                                                                                    
                                                                                                         
                                                         
     
                                                                    
                                              
     
                                                                                                             
                                                        
 

/**
 * Module-scoped singleton event emitter (`events` export). Adds
 * `connect()` for cross-runtime forwarding (e.g. worker → main thread);
 * forwarders compose and each `connect` returns its own unsubscribe.
 */
                                                 
                                                                 
  

/**
 * What a request-style backend handler receives: the emitted payload, and the
 * responder the worker bridge builds from the inbound message's `eventId`.
 * `$APP.frontend.handleMessage` wires it through for every request; a handler
 * that answers its caller declares this shape with its own payload type.
 */
                                                            
             
                                     
                   
 

/** Re-export runtime types from the JS entry so the bare `@bootstrapp/events` specifier surfaces both the type-only declarations above AND the JSDoc-inferred types of runtime exports (so e.g. `import type View from "/app/light/view/index.js"` resolves). */
export * from "./index.js";
export { default } from "./index.js";
