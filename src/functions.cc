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
                    
                bson_iterator it;
                bson_find_from_buffer(&it, input_buffer, "addEndpoint");
                
                if(bson_iterator_type(&it) != BSON_EOO) {
                    //printf("addEndpoint:\n");
                    bson_visit( (uint8_t*)input_buffer, elem_visitor);
                } else {

                    bson_find_from_buffer(&it, input_buffer, "update");
                    mist_ep* ep = NULL;
                    char* ep_name = (char*) "";

                    if ( bson_iterator_type(&it) == BSON_STRING ) {
                        ep_name = (char*) bson_iterator_string(&it);
                        mist_find_endpoint_by_name(model, ep_name, &ep);
                        if (ep == NULL) {
                            WISHDEBUG(LOG_CRITICAL, "update could not find endpoint %s", ep_name);
                            return;
                        }
                    }

                    bson_find_from_buffer(&it, input_buffer, "value");

                    if ( bson_iterator_type(&it) == BSON_BOOL ) {
                        //WISHDEBUG(LOG_CRITICAL, "updating endpoint");
                        relay_state = bson_iterator_bool(&it);
                        mist_value_changed(model, ep_name);
                    }
                }
            }
        }
        
        input_buffer_len = 0;
    } else {
        // last message has not been consumed
        //printf("Lock acquired, but no data.\n");
    }

    // release lock   
    pthread_mutex_unlock(&mutex1);
}

static enum mist_error hw_read_relay(mist_ep* ep, void* result) {
    bool* bool_result = (bool*) result;
    *bool_result = relay_state;

    return MIST_NO_ERROR;
}

static enum mist_error hw_write_relay(mist_ep* ep, void* new_value) {
    bool* bool_value = (bool*) new_value;
    relay_state = *bool_value;

    printf("Write to endpoint %s : %s\n", ep->label, relay_state == true ? "true" : "false");

    return MIST_NO_ERROR;
}

static enum mist_error hw_read_string(mist_ep* ep, void* result) {
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

static void periodic_cb(void* ctx) {
    mist_api_periodic_cb_impl(NULL);
}

static void* setupMist(void* ptr) {

    // name used for WishApp and MistNode name
    char* name = (char*) "Node";

    //start wish apps
    mist_app = start_mist_app();

    model = &(mist_app->model);
    
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
