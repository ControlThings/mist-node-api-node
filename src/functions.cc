#include "functions.h"
#include "mist_app.h"
#include "mist_api.h"
#include "mist_model.h"
#include "mist_follow.h"
#include "wish_core_client.h"
#include "bson_visitor.h"
#include "bson.h"

#include <pthread.h>
#include <stdio.h>

static void init(wish_app_t* app) {
    //WISHDEBUG(LOG_CRITICAL, "API ready!");
}

pthread_mutex_t mutex1 = PTHREAD_MUTEX_INITIALIZER;

bool relay_state = false;

static wish_app_t *app;
static mist_app_t* mist_app;
static mist_api_t* api;
static struct mist_model* model;

static int input_buffer_len = 0;
static char input_buffer[2048];
static int input_type = 0;
static bool node_api_plugin_kill = false;

bool injectMessage(int type, uint8_t *msg, int len) {
    if (pthread_mutex_trylock(&mutex1)) {
        return NULL;
    }

    bool success = false;
    
    // check if we can inject a new message, i.e input buffer is consumed by Mist
    if (input_buffer_len == 0) {
        // last message was consumed, injecting new message
        input_type = type;
        memcpy(input_buffer, msg, len);
        input_buffer_len = len;
        success = true;
    } else {
        // last message has not been consumed
    }
    
    // release lock   
    pthread_mutex_unlock(&mutex1);
    return success;
}

static void list_services_cb(struct wish_rpc_entry* req, void* ctx, uint8_t* data, size_t data_len) {
    //printf("response going towards node.js.\n");
    //bson_visit(data, elem_visitor);

    Test::send(data, data_len);
    
    //static_cast<EvenOdd*>(evenodd_instance)->sendToNode(data, data_len);
}

static enum mist_error hw_read(mist_ep* ep, void* result) {
    if (ep->data == NULL) { return MIST_ERROR; }
    
    if (ep->type == MIST_TYPE_FLOAT) {
        double v = *((double*) ep->data);
        double *t = (double*) result;
        *t = v;
    } else if (ep->type == MIST_TYPE_BOOL) {
        bool v = *((bool*) ep->data);
        bool *t = (bool*) result;
        *t = v;
    }
    return MIST_NO_ERROR;
}

static enum mist_error hw_write(mist_ep* ep, void* value) {
    if (ep->data == NULL) { return MIST_ERROR; }
    
    bson bs;
    bson_init(&bs);
    bson_append_string(&bs, "epid", ep->id);
    
    if (ep->type == MIST_TYPE_FLOAT) {
        double v = *((double*) value);
        double *t = (double*) ep->data;
        *t = v;
        bson_append_double(&bs, "data", v);
    } else if (ep->type == MIST_TYPE_BOOL) {
        bool v = *((bool*) value);
        bool *t = (bool*) ep->data;
        *t = v;
        bson_append_bool(&bs, "data", v);
    } else {
        printf("Unsupported MIST_TYPE %i\n", ep->type);
    }
    
    bson_finish(&bs);
        
    Test::write((uint8_t*) bson_data(&bs), bson_size(&bs));
    
    return MIST_NO_ERROR;
}

static enum mist_error hw_invoke(mist_ep* ep, mist_buf args, mist_buf response) {
    printf("in hw_invoke\n");
    return MIST_NO_ERROR;
}

/*
static enum mist_error hw_read_relay(mist_ep* ep, void* result) {
    bool* bool_result = (bool*) result;
    *bool_result = relay_state;

    return MIST_NO_ERROR;
}

static enum mist_error hw_write_relay(mist_ep* ep, void* new_value) {
    bson bs;
    bson_init(&bs);
    bson_append_string(&bs, "epid", ep->id);
    if (ep->type == MIST_TYPE_BOOL) {
        bool* bool_value = (bool*) new_value;
        relay_state = *bool_value;
        
        bson_append_bool(&bs, "data", relay_state);
    } else {
        printf("Unsupported MIST_TYPE %i\n", ep->type);
    }
    bson_finish(&bs);
    
    Test::write((uint8_t*) bson_data(&bs), bson_size(&bs));

    return MIST_NO_ERROR;
}

static enum mist_error hw_read_string(mist_ep* ep, void* result) {
    WISHDEBUG(LOG_CRITICAL, "hw_read_string %p data: %p", ep, ep->data);
    memcpy(result, "nodejs plugins rule!", 21);
    return MIST_NO_ERROR;
}

static enum mist_error hw_invoke_function(mist_ep* ep, mist_buf args, mist_buf response) {
    printf("in hw_invoke_function\n");
    bson_visit( (uint8_t*)args.base, elem_visitor);
    
    bson bs;
    bson_init_buffer(&bs, response.base, response.len);
    bson_append_int(&bs, "number", 7);
    bson_append_bool(&bs, "cool", true);
    bson_finish(&bs);

    return MIST_NO_ERROR;
}
*/

static void mist_api_periodic_cb_impl(void* ctx) {
    if (pthread_mutex_trylock(&mutex1)) {
        //WISHDEBUG(LOG_CRITICAL, "Failed trylock. Fail-safe worked!");
        return;
    }
    
    if(node_api_plugin_kill) {
        //printf("killing loop from within.\n");
        wish_core_client_close(NULL);
    }

    // check if we can inject a new message, i.e input buffer is consumed by Mist

    if (input_buffer_len > 0) {
        // last message was consumed, injecting new message
        // by writing new message to input buffer
        //printf("Lock acquired, consuming\n");
        //bson_visit( (uint8_t*) input_buffer, elem_visitor);

        bson_iterator it;
        bson_find_from_buffer(&it, input_buffer, "kill");
        
        if (bson_iterator_type(&it) == BSON_BOOL) {
            //printf("kill is bool\n");
            if (bson_iterator_bool(&it)) {
                //printf("kill is true\n");
                node_api_plugin_kill = true;
            }
        } else {
            //printf("Making mist_api_request\n");
            
            bson bs;
            bson_init_buffer(&bs, input_buffer, input_buffer_len);
            
            if(input_type == 1) { // WISH
                //printf("### Wish\n");
                wish_api_request(&bs, list_services_cb);
            } else if (input_type == 2) { // MIST
                //printf("### Mist\n");
                mist_api_request(&bs, list_services_cb);
            } else if (input_type == 3) { // MIST NODE API
                //printf("MistNodeApi got message from node.js:\n");
                    
                bson_find_from_buffer(&it, input_buffer, "model");
                
                if(bson_iterator_type(&it) != BSON_EOO) {
                    //printf("model:\n");
                    //bson_visit( (uint8_t*)input_buffer, elem_visitor);
                    
                    bson_iterator_init(&it, &bs);
                    bson_find_fieldpath_value("model.device", &it);
                    if(bson_iterator_type(&it) != BSON_STRING) {
                        goto consume_and_unlock;
                    }
                    
                    char* name = strdup(bson_iterator_string(&it));
                    //printf("Name in model: %s\n", name);
                    
                    //mist_set_name(mist_app, name);
                    
                    bson_iterator_init(&it, &bs);
                    bson_find_fieldpath_value("model.model", &it);
                    if(bson_iterator_type(&it) != BSON_OBJECT) {
                        printf("model.model not object, type is %i\n", bson_iterator_type(&it));
                        goto consume_and_unlock;
                    }
                    
                    bson_iterator modelit;
                    bson_iterator_subiterator(&it, &modelit);

                    //printf("creating subiterator for model.model\n");
                    
                    int c = 0;
                    
                    while ( bson_iterator_next(&modelit) == BSON_OBJECT ) {
                        
                        char* ep_id = strdup( (char*) bson_iterator_key(&modelit) );
                        
                        bson_iterator epit;
                        
                        bson_iterator_subiterator(&modelit, &epit);
                        bson_find_fieldpath_value("label", &epit);
                        if( bson_iterator_type(&epit) != BSON_STRING) {
                            continue;
                        }
                        char* ep_label = strdup(bson_iterator_string(&epit));
                        
                        bson_iterator_subiterator(&modelit, &epit);
                        bson_find_fieldpath_value("type", &epit);
                        if( bson_iterator_type(&epit) != BSON_STRING) {
                            continue;
                        }
                        char* ep_type = (char*) bson_iterator_string(&epit);
                        
                        bool readable = false;
                        
                        // data: _anything_
                        bson_iterator_subiterator(&modelit, &epit);
                        bson_find_fieldpath_value("data", &epit);
                        if( bson_iterator_type(&epit) != BSON_EOO) {
                            readable = true;
                        }
                        
                        // read: true
                        bson_iterator_subiterator(&modelit, &epit);
                        bson_find_fieldpath_value("read", &epit);
                        if( bson_iterator_type(&epit) == BSON_BOOL) {
                            if ( bson_iterator_bool(&it) ) {
                                readable = true;
                            }
                        }
                        
                        bool writable = false;
                        
                        bson_iterator_subiterator(&modelit, &epit);
                        bson_find_fieldpath_value("write", &epit);
                        if( bson_iterator_type(&epit) == BSON_BOOL) {
                            writable = bson_iterator_bool(&it);
                        }
                        
                        bool invokable = false;
                        
                        bson_iterator_subiterator(&modelit, &epit);
                        bson_find_fieldpath_value("invoke", &epit);
                        if( bson_iterator_type(&epit) != BSON_EOO) {
                            invokable = true;
                        }
                        
                        //printf("ep_id: %s\n", ep_id);
                        //printf("ep_label: %s\n", ep_label);
                        //printf("ep_type: %s\n", ep_type);
                        
                        // allocate a new endpoint and space for data
                        mist_ep* ep = (mist_ep*) malloc(sizeof(mist_ep));
                        if (ep == NULL) { break; }
                        memset(ep, 0, sizeof(mist_ep));
                        ep->data = (char*) malloc(32);
                        if (ep->data == NULL) { free(ep); break; }
                        memset(ep->data, 0, 32);
                        
                        ep->id = ep_id;
                        ep->label = ep_label;
                        if ( strncmp(ep_type, "float", 16) == 0 ) {
                            //printf("A float.\n");
                            ep->type = MIST_TYPE_FLOAT;
                            *((double*) ep->data) = 0.0;
                        } else if ( strncmp(ep_type, "bool", 16) == 0 ) {
                            //printf("A bool.\n");
                            ep->type = MIST_TYPE_BOOL;
                            *((bool*) ep->data) = false;
                        } else {
                            continue;
                        }
                        
                        if (readable) { ep->read = hw_read; }
                        if (writable) { ep->write = hw_write; }
                        if (invokable) { ep->invoke = hw_invoke; } //hw_invoke_function;
                        ep->unit = NULL;
                        ep->next = NULL;
                        ep->prev = NULL;
                        ep->dirty = false;
                        ep->scaling = NULL;

                        
                        mist_add_ep(model, ep);
                        
                        //printf("ep_read %p %d\n", ep->read, ep->readable);
                        //printf("ep_write %p %d\n", ep->write, ep->writable);
                        //printf("ep_invoke %p %d\n", ep->invoke, ep->invokable);
                        //printf("ep_next %p\n", ep->next);
                        
                        c++;
                        
                        if(c>4) { break; }
                    }
                    
                    //mist_set_name(mist_app, name);
                } else {

                    bson_find_from_buffer(&it, input_buffer, "update");
                    mist_ep* ep = NULL;
                    char* ep_name = (char*) "";

                    if ( bson_iterator_type(&it) != BSON_STRING ) {
                        goto consume_and_unlock;
                    }
                    
                    ep_name = (char*) bson_iterator_string(&it);
                    mist_find_endpoint_by_name(model, ep_name, &ep);
                    if (ep == NULL) {
                        WISHDEBUG(LOG_CRITICAL, "update could not find endpoint %s", ep_name);
                        goto consume_and_unlock;
                    }

                    bson_find_from_buffer(&it, input_buffer, "value");
                    
                    if (ep->type == MIST_TYPE_BOOL) {
                        if ( bson_iterator_type(&it) == BSON_BOOL ) {
                            *((bool*)ep->data) = bson_iterator_bool(&it);
                            mist_value_changed(model, ep_name);
                        }
                    } else if (ep->type == MIST_TYPE_FLOAT) {
                        if (ep->data == NULL) { goto consume_and_unlock; }
                        
                        if ( bson_iterator_type(&it) == BSON_DOUBLE ) {
                            *((double*)ep->data) = bson_iterator_double(&it);
                            mist_value_changed(model, ep_name);
                        } else if ( bson_iterator_type(&it) == BSON_INT ) {
                            *((double*)ep->data) = (double) bson_iterator_int(&it);
                            mist_value_changed(model, ep_name);
                        }
                    }
                }
            }
        }
        
consume_and_unlock:
        
        input_buffer_len = 0;
    } else {
        // last message has not been consumed
        //printf("Lock acquired, but no data.\n");
    }

    // release lock   
    pthread_mutex_unlock(&mutex1);
}

static void periodic_cb(void* ctx) {
    mist_api_periodic_cb_impl(NULL);
}

static void* setupMist(void* ptr) {

    // name used for WishApp and MistNode name
    char* name = (char*) "Node";

    //start wish apps
    mist_app = start_mist_app();

    model = &(mist_app->model);
    
    /*
    mist_ep relay = {
        id : (char*) "state", 
        label : (char*) "Relay", 
        type : MIST_TYPE_BOOL,
        unit : NULL,
        data : NULL,
        readable : true,
        writable : true,
        invokable : false,
        read : hw_read_relay,
        write : hw_write_relay,
        invoke : NULL,
        next : NULL,
        prev : NULL,
        dirty : false,
        scaling : NULL
    };
    
    mist_ep string = {
        id : (char*) "my_str", 
        label : (char*) "My String", 
        type : MIST_TYPE_STRING,
        unit : NULL,
        data : NULL,
        readable : true,
        writable : false,
        invokable : false,
        read : hw_read_string,
        write : NULL,
        invoke : NULL,
        next : NULL,
        prev : NULL,
        dirty : false,
        scaling : NULL
    };
    
    mist_ep function = {
        id : (char*) "function", 
        label : (char*) "Function", 
        type : MIST_TYPE_INVOKE,
        unit : NULL,
        data : NULL,
        readable : false,
        writable : false,
        invokable : true,
        read : NULL,
        write : NULL,
        invoke : hw_invoke_function,
        next : NULL,
        prev : NULL,
        dirty : false,
        scaling : NULL
    };
    
    mist_add_ep(model, &relay);
    mist_add_ep(model, &string);
    mist_add_ep(model, &function);
    */

    model->custom_ui_url = (char*) "https://mist.controlthings.fi/mist-io-switch-0.0.2.tgz";
    
    mist_set_name(mist_app, name);
    
    app = wish_app_create(name);
    wish_app_add_protocol(app, &mist_app->ucp_handler);
    mist_app->app = app;
    
    app->periodic = periodic_cb;
    app->periodic_ctx = NULL;
    
    if (app == NULL) {
        printf("Failed creating wish app\n");
        return NULL;
    }
    
    
    
    wish_core_client_init(app);
    
    return NULL;
}

pthread_t thread1;

void mist_addon_start() {
    const char *message1 = "Thread 1";
    //const char *message2 = "Thread 2";
    int iret1;
    //int iret2;

    /* Create independent threads each of which will execute function */

    iret1 = pthread_create(&thread1, NULL, setupMist, (void*) message1);
    if (iret1) {
        fprintf(stderr, "Error - pthread_create() return code: %d\n", iret1);
        exit(EXIT_FAILURE);
    }
}
