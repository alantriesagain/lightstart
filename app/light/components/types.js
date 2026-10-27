/**
 * @lightstart/light/components: public type declarations.
 */

                                                                          

/** Anything a component may place in a template: what a caller-supplied render callback returns. */
                                                                     

/** utils/highlight.js: one coloured run of a code line; `type` is null for plain text. */
                      
               
                      
 

/** app/stories.js: the viewer controls handed to every story render callback. */
                               
                    
                              
                
                
 

/** app/stories.js: a caller-supplied renderer for one story item. */
                                                                             

/** app/stories.js: resolves the blurred backdrop image URL for one story item. */
                                                        

/** app/swipe-deck.js: the deck controls handed to every card render callback. */
                                   
                
                
                
                   
                   
                   
                   
 

/** app/swipe-deck.js: a caller-supplied renderer for one card or the footer under it. */
                                                                                     

/** app/swipe-deck.js: what to draw once the deck has run out. */
                                              

/** app/swipe-deck.js: resolves the URL painted behind the stack for one item. */
                                                            

/** app/swipe-deck.js: copy for the two buttons and the counter; `{i}` and `{n}` are substituted. */
                                  
                
                
                
                   
 

/** app/swipe-deck.js: one committed swipe, kept so it can be undone. */
                                   
                
                
                              
 

/** app/app-container.js: the history state `navigate` pushes, read back on `popstate`. */
                                
                
                                  
 

/** display/calendar.js: an event on the calendar grid/list. */
                                
                      
               
                
                        
                                        
                             
                            
                                       
                    
                 
                
                 
                   
 

/** display/calendar.js: how often a recurring event repeats. */
                                                                          

/** display/calendar.js: a caller-supplied renderer for one event chip. */
                                                                         

/** display/calendar.js: the callback fired when an event is dropped on a day cell. */
                                                                                         

/** display/calendar.js: a single day cell in the month grid. */
                              
             
              
                          
                   
                          
 

/** form/select.js: one <lc-select> option (either a plain value or a { value, label } pair). */
/** Which mask rule of an icon an element draws: the outline, `solid` or `bold`. */
                                                

                               
                  
                  
                                                                            
                   
                       
 

/** page/steps-section.js: one step in the `steps` array property. */
                           
                  
                 
                       
                
                     
                       
                           
                              
                            
                                                 
                        
 

/** feedback/stepper.js: one entry in the `steps` array property. */
                              
             
                
                                                               
                       
                                                     
                 
 

/** display/comment.js: the `actions` render property, drawn in the comment's actions row. */
                                              

/** display/timeline.js: one entry in the `entries` array property. */
                                
             
                 
                
                
                            
                
 

/** display/timeline.js: an entry's marker colour, `lc-badge`'s vocabulary. */
                                                                                                              

/** display/timeline.js: the `extra` render property, drawn under each entry. */
                                                                 

/** utils/day-groups.js: what `readAt` makes of an entry's `at`. */
                                                                                                                      

/** utils/day-groups.js: one group `groupByDay` answers; `day` is null for the unreadable entries. */
                              
                     
                           
 

/** page/steps-section.js: the `footerCta` object property. */
                            
                 
                
                
 

/** page/testimonial-section.js: one entry in the `testimonials` array property. */
                              
                  
                 
                  
                  
                
 

/** A searchable document rendered by `lc-search` / matched by `lc-search`'s matcher. */
                            
                      
                
                
                
                
                       
 

/** page/pricing-card.js: the `cta` object property. */
                             
                 
                
 

                            
               
               
                 
                     
                       
                
                                                                                 
                         
                                                                                      
                       
                                                                                      
                  
                         
                                                                                                       
                
                       
                                                                                   
                  
                   
                                                                                     
                        
                        
                         
                     
                     
                                                                                         
                 
     
                                                                             
                                                                            
                                                                    
     
                                                                      
                                                                          
                       
                                                    
                           
                                                                                          
                        
                                                                                               
                        
                                                                                  
                    
                      
     
                                                                            
                                                                        
                         
     
                                                                                                                 
                                
                                                                                       
                                                                                                           
                                                                                         
                   
     
                                                                              
                                                                              
                                           
     
                         
 

                                  
                                                            
                                                              
            
                     
                   
                                          
                  
 

/** form/field-renderers.js: a renderer registered for one `field.cmsType`. */
                                 
                   
                 
                                        
                                                     
                

/** form/form.js: a control `collectFormData` reads; the native inputs and the `lc-*` controls share this surface. */
                                                     
                
                
                    
                     
                  
 

                                                               

                                
                 
                 
                 
 

/** display/table.js: a `<lc-table>` column descriptor. */
                              
               
                 
                 
                     
                                                                                                
                
                                                            
                                                                                        
                                         
 

/** display/data-table.js: the model `<lc-data-table>` pages when it pages a query rather than rows. */
                                 
                
                                  
                      
 

/** display/table.js: one `<lc-table>` row; every cell is drawn, so every cell is renderable. */
                                                  

/** display/table.js: the click handler a caller hands `<lc-table>`'s `selectRow`. */
                                                               

/** Whether a table row is the one picked, drawn marked. */
                                                          

/** page/hero-section.js: the eyebrow badge/label above the headline. */
                              
                 
                 
                
                
 

/** page/hero-section.js: a call-to-action button below the headline. */
                          
                 
                
                                    
 

/** A single FAQ entry rendered by `lc-faq-section`. */
                          
                   
                 
 

/** navigation/tree-item.js: an `<lc-tree-item>` as `<lc-tree>` moves through it. */
                                                      
                    
                          
 

/** form/search.js: an `<lc-search>` as a host focuses its input. */
                                                    
                     
 

/** overlay/command-palette.js: an `<lc-command-palette>` as a page opens it. */
                                                            
                
 

/** form/radio.js: a sibling `<lc-radio>` in the same radio group. */
                                               
                    
                     
                
                 
                
                   
 

/** overlay/alert-dialog.js: the dialog's visual variant. */
                                                                                

/** utils/roving.js: how a list answers an arrow key. */
                                
                                                                             
                 
                                                                           
                                                   
                                     
                    
 

/** overlay/anchor.js: which edge of the trigger a floating box sits against. */
                                                             

/** overlay/anchor.js: where the box sits along the trigger's other axis. */
                                                     

/** overlay/anchor.js: the size of a box, which is all the anchor math needs of it. */
                      
                
                 
 

/** overlay/anchor.js: the part of a DOMRect the anchor math reads. */
                                   
              
               
                
                 
 

/** mixins/swipe-threshold.js: where the pointer that may become a swipe went down. */
                             
                    
            
            
 

/** mixins/pointer-drag.js: the one pointer a drag follows, and how far it has travelled. */
                            
                    
                 
                 
            
            
             
             
 

/** mixins/pointer-drag.js: what `onDragStart` is handed once the gesture is accepted. */
                            
            
            
               
 

/** mixins/pointer-drag.js: what `onDragMove` is handed, once per animation frame. */
                           
             
             
            
            
 

/** mixins/pointer-drag.js: what `onDragEnd` is handed; `cancelled` means the platform took the gesture away. */
                          
             
             
            
            
                     
 

/** mixins/pointer-drag.js: the hooks a host may answer, all optional. */
                                  
                                       
                                    
                                                 
                                                          
 

/** mixins/swipe-threshold.js: the hook a host answers, with -1 for a swipe toward the start of the axis and 1 toward its end. */
                            
                                    
 

/** mixins/overlay.js: the hook a host that answers Escape declares. */
                              
                    
 

/** mixins/escape-key.js: the hook a host answers, handed the Escape keydown. */
                                
                                    
 

/** mixins/pull-to-refresh.js: the hook a host refreshes in; the indicator holds until it settles. */
                                    
                        
 

/** overlay/drag-panel.js, overlay/bottom-sheet.js: a named stop of a draggable sheet. */
                                                    

/** overlay/drag-panel.js: the y offset (translateY from fully open) of each stop. */
                                                     

/** overlay/bottom-sheet.js: what the sheet measures once at the start of a drag. */
                                
                     
               
                               
                 
               
               
 

/** utility/droparea.js: what `onDropped` is handed when a drag lands on the area. */
                           
                    
                   
                   
                    
                                                                  
                 
 

/** form/form.js: the imperative surface `<lc-form>` exposes to a host element. */
                                                 
                    
                                                                     
                                     
                      
 

/** mixins/popover.js: the imperative surface every popover-based overlay exposes. */
                                                    
                                               
 

/** A kanban board column. */
                               
               
                 
                
                 
 

/** A row rendered as a kanban card; carries an arbitrary grouping field. */
                                                            
                      
                 
                
 

/** Where a dropped kanban card lands relative to the card it was dropped on. */
                                      
                                   
                                  
                                      
 

/** Fired when a kanban card is dropped into a column. */
                          
                    
                     
                                 
          

/** Fired when a new card title is submitted in a kanban column footer. */
                                                                    

/** Fired when a kanban card is clicked. */
                                                    

/** A caller-supplied renderer for one kanban card. */
                                                               

/** A caller-supplied renderer for a kanban column's header actions. */
                                                                        

/** Active drag/drop target state for a kanban board. */
                                   
                 
                                 
                 
 

/** A single toast notification, fully resolved (defaults applied). */
/** What `toasts.show` takes. */
                               
                 
                   
                   
                
                    
                     
                     
 

/** feedback/toasts.js: the notification queue. */
                             
                                                                 
                                       
                                                           
                                                         
                                                           
                                                        
                        
                         
                  
 

                            
             
                
                  
                  
                                                           
               
                   
                    
                                                                    
                     
 

/** A breadcrumb trail entry, parsed from `<a>`/`<span>` children or passed in directly. */
                                 
                      
                      
                  
 

/** One crumb `lc-page-header` draws before its title; one without `href` is plain text. */
                                  
                
                
 

/** A single stat tile rendered by `lc-stats-section`. */
                           
                 
                 
                       
                
 

/** The `image` property of `lc-showcase-section`. */
                                
               
               
 

/** A single call-to-action rendered by `lc-showcase-section`. */
                              
                 
                
                   
 

/** page/catalog.js: one entry of the page-section catalog. */
                               
              
                
               
 

/** page/sample-bootstrapp.js: one section of the sample page, with the props it hands its component. */
                                
               
                                    
 

/** page/sample-bootstrapp.js: the sample page the showcase previews render from. */
                             
                        
                        
                            
 

/** A header/footer/body section descriptor rendered by `lc-page`. */
                              
               
                                  
 

/** A single data point plotted by `lc-line-chart`. */
                                 
                
                 
 

/** A `lc-segmented` option: a plain string is normalized to `{ value, label: value }`; a label may be a template (an icon and a badge beside the text). */
/** form/day-strip.js: one day of the strip, as drawn. */
                              
               
                  
              
                 
               
 

/** utils/week-hours.js: one day's hours, `HH:MM`; a close at or before the open runs past midnight. */
                               
               
                
 

/** utils/week-hours.js: the days (0 Sunday to 6 Saturday) that keep the same hours. */
                                                      
                 
 

/** form/crop-rect.js: the square of a picture a crop frame shows, in the picture's pixels. */
                           
            
            
               
 

/** form/crop-rect.js: a picture's size, and the smallest square a crop may zoom in to. */
                             
                
                 
                  
 

/** form/crop-rect.js: a point of the frame, in screen pixels. */
                            
            
            
 

/** form/crop-rect.js: what a key asks of a crop. */
                                                                                        

/** form/month-picker.js: one cell of the grid, as drawn. */
                                 
               
              
                   
                 
               
                    
                
                  
 

                                  
                
                     
                
                                                                                  
                          
 

/** A `lc-sparkline` data point: a bare number or an object carrying `value`. */
                                                        

/** `lc-footer`'s `brand` property shape. */
                              
                
                
                
 

/** `lc-footer`'s `columns` item shape. */
                               
                 
                       
 

/** A single link inside a `FooterColumn`. */
                             
                 
                
 

/** `lc-footer`'s `socials` item shape. */
                               
                
                
 

/** `lc-pricing-table`'s `plans` item shape. */
                              
                
                 
                  
                       
                      
                                          
                        
 

/** A single call-to-action button in `<lc-cta-section>`'s `ctas` array. */
                                   
                
                
                                    
 

/** A single card in `<lc-feature-grid>`'s `features` array. */
                                  
                
                 
                       
 

/** A single datum of `<lc-bar-chart>`'s `data` array. */
                                
                 
                 
 

/** display/flow.js: one step of a lane. */
                           
                                                                                    
             
                
                                
                  
                                                                                 
                 
                            
 

/** display/flow.js: one entry in the `lanes` array property. */
                           
             
                
                                       
                  
                    
 

/** `<lc-site-header>`'s `brand` property. */
                                  
                
                
                
 

/** A single row of `<lc-site-header>`'s `links` array. */
                                 
                
               
 

/** A single row of `<lc-site-header>`'s `actions` array. */
                                   
                
               
                                    
 

/** Minimal shape of the lazily-loaded `marked` module used by `<lc-markdown>`. */
                             
                             
                              
 

/** One link of a `<lc-nav-tree>` group. */
                              
                
               
                 
                  
 

/** One group of `<lc-nav-tree>`: a heading over its links. */
                               
             
                
                
                 
                       
 

/** One neighbour of `<lc-pagination variant="pager">`: where it leads and what it is called. */
                            
                
               
                
 

/** A heading `<lc-markdown>` rendered, as its `markdown-rendered` event reports it. */
                                  
             
               
                
 

/** One entry of `<lc-toc>`'s `items`: a heading the page has, by id. */
                          
             
                
                 
 

/** A single row of `<lc-dropdown>`'s structured `items` array. */
                               
                 
                
                               
                    
                   
                     
                     
                    
                  
 

/** One row of `lc-context-menu`: a leaf with an action, a parent with children, or a separator. */
                                  
                 
                
                      
                                                                                        
                 
                      
                   
                     
                                        
                               
                       
 

/** The `lc-context-menu` element as a caller drives it. */
                                                      
                           
                  
                                                                                             
                                                                                                            
                
 

/** What `anim-drag-panel` measures once at the start of a drag; the pointer itself is `withPointerDrag`'s. */
                            
               
                     
                 
                                           
                        
 

/** What an overlay hands the stack when it opens. */
                                 
                                                              
                       
                                                                    
                        
                                                                   
                       
                                                             
                         
 

/** One open layer, as the stack holds it. */
                                                      
             
                
                       
                      
                             
 
