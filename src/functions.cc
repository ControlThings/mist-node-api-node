#include "functions.h"
#include "mist_app.h"
#include "mist_api.h"
#include "wish_core_client.h"
#include "bson_visitor.h"
#include "bson.h"

#include <pthread.h>
#include <stdio.h>

static enum mist_error hw_read_string(mist_ep* ep, void* result) {
    memcpy(result, "nodejs plugins rule!", 21);
    return MIST_NO_ERROR;
}

static void init(wish_app_t* app) {
    //WISHDEBUG(LOG_CRITICAL, "API ready!");
}

pthread_mutex_t mutex1 = PTHREAD_MUTEX_INITIALIZER;

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
        // by writing new message to input buffer
        //printf("Lock acquired, injecting %02x %02x %02x %02x %02x %02x\n", msg[0], msg[1], msg[2], msg[3], msg[4], msg[5]);
        input_type = type;
        memcpy(input_buffer, msg, len);
        input_buffer_len = len;
        success = true;
    } else {
        // last message has not been consumed
        //printf("Lock acquired, but last message was not consumed yet.\n");
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

static wish_app_t *app;
static mist_app_t* mist_app;
static mist_api_t* api;

static void* setupMist(void* ptr) {

    // name used for WishApp and MistNode name
    const char *name = "MistApi";

    //start wish apps
    mist_app = start_mist_app();

    struct mist_model *model = &(mist_app->model);
    
    // Must be in this exact order with all members initialized
    mist_ep string = {
        id : (char*) "info", 
        label : (char*) "Mist API", 
        type : MIST_TYPE_STRING,
        unit : NULL,
        data : NULL,
        readable : false,
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
    
    mist_add_ep(model, &string);

    mist_set_name(mist_app, (char*)name);
    
    app = wish_app_create((char*)name);
    wish_app_add_protocol(app, &mist_app->ucp_handler);
    mist_app->app = app;

    api = mist_api_init(mist_app);
    api->periodic = mist_api_periodic_cb_impl;
    api->periodic_ctx = api;
    
    app->ready = init;
    
    if (app == NULL) {
        printf("Failed creating wish app");
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
