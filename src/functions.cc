#include "Mist.h"
#include "functions.h"
#include "mist_app.h"
#include "mist_api.h"
#include "mist_model.h"
#include "mist_handler.h"
#include "mist_follow.h"
#include "wish_core_client.h"
#include "wish_platform.h"
#include "bson_visitor.h"
#include "bson.h"
#include "utlist.h"

#include <pthread.h>
#include <stdio.h>
#include <string>

using namespace std;

struct wish_app_core_opt {
    Mist* mist;
    mist_api_t* mist_api;
    mist_app_t* mist_app;
    wish_app_t* wish_app;
    char* name;
    char* ip;
    int port;
    struct wish_app_core_opt* next;
    struct wish_app_core_opt* prev;
};

struct wish_app_core_opt* wish_app_core_opts;

/*
static void init(wish_app_t* app) {
    //WISHDEBUG(LOG_CRITICAL, "API ready!");
}
*/

pthread_mutex_t mutex1 = PTHREAD_MUTEX_INITIALIZER;

#define SANDBOX_RPC_MSG_LEN_MAX     (16*1024)

static int input_buffer_len = 0;
static char input_buffer[2048];
static int input_type = 0;
static bool node_api_plugin_kill = false;
static Mist* mistInst;

bool injectMessage(Mist* mist, int type, uint8_t *msg, int len) {
    if (pthread_mutex_trylock(&mutex1)) {
        printf("Unsuccessful injection lock.\n");
        return NULL;
    }

    bool success = false;
    
    // check if we can inject a new message, i.e input buffer is consumed by Mist
    if (input_buffer_len == 0) {
        // last message was consumed, injecting new message
        input_type = type;
        memcpy(input_buffer, msg, len);
        input_buffer_len = len;
        mistInst = mist;
        success = true;
    } else {
        // last message has not been consumed
    }
    
    // release lock   
    pthread_mutex_unlock(&mutex1);
    return success;
}

static void mist_response_cb(struct wish_rpc_entry* req, void* ctx, uint8_t* data, size_t data_len) {
    
    if (req == NULL) {
        // regular request
    } else {
        // passthru request
        ctx = ((wish_rpc_ctx *)ctx)->context;
    }
    
    std::string a = "even";
    std::string b = "dummy";
    
    Message msg(a, b, (uint8_t*) data, data_len);
    
    static_cast<Mist*>(ctx)->sendToNode(msg);
}

static void wish_response_cb(struct wish_rpc_entry* req, void* ctx, uint8_t* data, size_t data_len) {
    if(ctx == NULL) {
        if (req->passthru_ctx2 != NULL) {
            ctx = req->passthru_ctx2;
        } else {
            printf("NULL ctx in response going towards node.js. ctx %p\n", ctx);
            bson_visit("NULL ctx request:", (uint8_t*)data);
            return;
        }
    }
    
    std::string a = "even";
    std::string b = "dummy";
    
    Message msg(a, b, (uint8_t*) data, data_len);
    
    static_cast<Mist*>(ctx)->sendToNode(msg);
}

static void sandboxed_response_cb(struct wish_rpc_entry* req, void* ctx, uint8_t* data, size_t data_len) {
    //printf("sandboxed response going towards node.js. ctx %p req %p\n", ctx, req);
    
    if (req == NULL) {
        // regular request
    } else {
        // request came from passthrough
        ctx = ((wish_rpc_ctx *)ctx)->context;
        //printf("   mist is here %p", ctx);
    }
    
    std::string a = "sandboxed";
    std::string b = "dummy";
    
    Message msg(a, b, (uint8_t*) data, data_len);
    
    static_cast<Mist*>(ctx)->sendToNode(msg);
}

static enum mist_error hw_read(mist_ep* ep, void* result) {
    if (ep->data == NULL) { return MIST_ERROR; }
    
    if (ep->type == MIST_TYPE_FLOAT) {
        double v = *((double*) ep->data);
        double *t = (double*) result;
        *t = v;
    } else if (ep->type == MIST_TYPE_INT) {
        int v = *((int*) ep->data);
        int *t = (int*) result;
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
    
    Mist* mist = NULL;
    struct wish_app_core_opt* opts;
    
    DL_FOREACH(wish_app_core_opts, opts) {
        if(opts->mist_app == ep->model->mist_app) {
            mist = opts->mist;
            //printf("    found Mist* %p\n", mist);
            break;
        }
    }
    
    if (mist == NULL) {
        printf("Failed finding mist instance to call write... bailing out!\n");
        return MIST_ERROR;
    }
    
    bson bs;
    bson_init(&bs);
    bson_append_string(&bs, "epid", ep->id);
    
    if (ep->type == MIST_TYPE_FLOAT) {
        double v = *((double*) value);
        double *t = (double*) ep->data;
        *t = v;
        bson_append_double(&bs, "data", v);
    } else if (ep->type == MIST_TYPE_INT) {
        int v = *((int*) value);
        int *t = (int*) ep->data;
        *t = v;
        bson_append_int(&bs, "data", v);
    } else if (ep->type == MIST_TYPE_BOOL) {
        bool v = *((bool*) value);
        bool *t = (bool*) ep->data;
        *t = v;
        bson_append_bool(&bs, "data", v);
    } else {
        printf("Unsupported MIST_TYPE %i\n", ep->type);
    }
    
    bson_finish(&bs);

    string a = "write";
    string b = "dummy";
    
    Message msg(a, b, (uint8_t*) bson_data(&bs), bson_size(&bs));
    
    static_cast<Mist*>(mist)->sendToNode(msg);
    
    return MIST_NO_ERROR;
}

static enum mist_error hw_invoke(mist_ep* ep, mist_buf args) {
    //printf("in hw_invoke %p\n", ep->model->mist_app);
    
    struct wish_app_core_opt* opts;
    Mist* mist = NULL;
    
    DL_FOREACH(wish_app_core_opts, opts) {
        if(opts->mist_app == ep->model->mist_app) {
            mist = opts->mist;
            //printf("    found Mist* %p\n", mist);
            break;
        }
    }
    
    if (mist == NULL) {
        printf("Failed finding mist instance to call... bailing out!\n");
        return MIST_ERROR;
    }
    
    bson bs;
    bson_init_data(&bs, args.base);
    
    string a = "invoke";
    string b = "dummy";
    
    Message msg(a, b, (uint8_t*) bson_data(&bs), bson_size(&bs));
    
    static_cast<Mist*>(mist)->sendToNode(msg);
    
    return MIST_NO_ERROR;
}

static void mist_api_periodic_cb_impl(void* ctx) {
    struct wish_app_core_opt* opts = (struct wish_app_core_opt*) ctx;
    mist_api_t* mist_api = opts->mist_api;

    //printf("mist_api_periodic_cb_impl Mist instance: %p\n", opts->mist);
    
    if (pthread_mutex_trylock(&mutex1)) {
        //WISHDEBUG(LOG_CRITICAL, "Failed trylock. Fail-safe worked!");
        return;
    }
    
    if(node_api_plugin_kill) {
        //printf("killing loop from within.\n");
        //wish_core_client_close(mist_api->wish_app);
        pthread_mutex_unlock(&mutex1);
        return;
    }
    

    // check if we can inject a new message, i.e input buffer is consumed by Mist

    if (input_buffer_len > 0) {
        
        if(opts->mist != mistInst) {
            //printf("This message is NOT for this instance of Mist!! this: %p was for %p\n", opts->mist, mistInst);
            pthread_mutex_unlock(&mutex1);
            return;
        } else {
            //printf("Right Mist!! this: %p was for %p\n", opts->mist, mistInst);
        }

        
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
            bson bs;
            bson_init_buffer(&bs, input_buffer, input_buffer_len);

            if(input_type == 1) { // WISH
                //printf("Making wish_api_request\n");
                //bson_visit((uint8_t*)bson_data(&bs), elem_visitor);
                wish_api_request_context(mist_api, &bs, wish_response_cb, opts->mist);
            } else if (input_type == 2) { // MIST
                //printf("### Mist\n");
                
                bson_iterator it;
                bson_find_from_buffer(&it, input_buffer, "cancel");

                if (bson_iterator_type(&it) == BSON_INT) {
                    printf("mist_cancel %i\n", bson_iterator_int(&it));
                    mist_api_request_cancel(mist_api, bson_iterator_int(&it));
                    goto consume_and_unlock;
                }
                
                //printf("Mist going into request context: %p cb %p\n", opts->mist, mist_response_cb);
                mist_api_request_context(mist_api, &bs, mist_response_cb, opts->mist);
            } else if (input_type == 3) { // MIST NODE API
                bson_visit("MistApi got message MistNodeApi command from node.js, not good!", (uint8_t*)bson_data(&bs));
            } else if (input_type == 4) { // MIST SANDBOXED API
                //printf("### Sandboxed Api\n");
                //WISHDEBUG(LOG_CRITICAL, "sandbox_api-request:");
                //bson_visit((uint8_t*)bson_data(&bs), elem_visitor);
                
                const char* sandbox_id = "";
                
                bson_iterator it;

                bson_find_from_buffer(&it, input_buffer, "cancel");

                if (bson_iterator_type(&it) == BSON_INT) {
                    int id = bson_iterator_int(&it);
                    
                    //printf("Node/C99: sandboxed_cancel %i\n", id);                    
                    
                    bson_find_from_buffer(&it, input_buffer, "sandbox");
                    
                    if ( bson_iterator_type(&it) == BSON_BINDATA && bson_iterator_bin_len(&it) == 32 ) {
                        // found the sandbox_id
                        sandbox_id = (char*) bson_iterator_bin_data(&it);
                    } else {
                        printf("Invalid sandbox id. 5 != %i || 32 != %i\n", bson_iterator_type(&it), bson_iterator_bin_len(&it));
                    }
                    
                    sandboxed_api_request_cancel(mist_api, sandbox_id, id);
                    goto consume_and_unlock;
                }
                
                
                // rewrite bson message to remove the first parameter of args
                
                bson_find(&it, &bs, "op");
                char* op = (char*)bson_iterator_string(&it);

                bson_find(&it, &bs, "id");
                int id = bson_iterator_int(&it);

                bson b;
                bson_init_size(&b, SANDBOX_RPC_MSG_LEN_MAX);

                bson_append_string(&b, "op", op);

                bson_iterator ait;
                bson_iterator sit;
                bson_find(&ait, &bs, "args");
                
                
                // init the sub iterator from args array iterator
                bson_iterator_subiterator(&ait, &sit);

                // read the argument
                bson_find_fieldpath_value("0", &sit);
                
                if ( bson_iterator_type(&sit) == BSON_BINDATA && bson_iterator_bin_len(&sit) == 32 ) {
                    // found the sandbox_id
                    sandbox_id = (char*) bson_iterator_bin_data(&sit);
                } else {
                    printf("Args first parameter was not BINDATA and len 32, bailing out!\n %i", bson_iterator_type(&sit));
                    // could not find sandbox_id, bailing out
                    bson_destroy(&b);
                    goto consume_and_unlock;
                }

                bool done = false;
                int i;
                int args_len = 0;

                bson_append_start_array(&b, "args");

                // Only single digit array index supported. 
                //   i.e Do not exceed 8 with the index. Rewrite indexing if you must!
                for(i=0; i<9; i++) {

                    char src[21];
                    BSON_NUMSTR(src, i+1);

                    char dst[21];
                    BSON_NUMSTR(dst, i);

                    // init the sub iterator from args array iterator
                    bson_iterator_subiterator(&ait, &sit);

                    // read the argument
                    //bson_find(&it, req, src);
                    bson_type type = bson_find_fieldpath_value(src, &sit);

                    // FIXME check type under iterator is valid
                    switch(type) {
                        case BSON_EOO:
                            done = true;
                            break;
                        case BSON_BOOL:
                            bson_append_bool(&b, dst, bson_iterator_bool(&sit));
                            break;
                        case BSON_INT:
                            bson_append_int(&b, dst, bson_iterator_int(&sit));
                            break;
                        case BSON_DOUBLE:
                            bson_append_double(&b, dst, bson_iterator_double(&sit));
                            break;
                        case BSON_STRING:
                        case BSON_BINDATA:
                        case BSON_OBJECT:
                        case BSON_ARRAY:
                            bson_append_element(&b, dst, &sit);
                            break;
                        default:
                            WISHDEBUG(LOG_CRITICAL, "Unsupported bson type %i in mist_passthrough", type);
                    }

                    if(done) {
                        break;
                    } else {
                        args_len++;
                    }
                }

                bson_append_finish_array(&b);
                bson_append_int(&b, "id", id);
                bson_finish(&b);

                //WISHDEBUG(LOG_CRITICAL, "sandbox_api-request re-written:");
                //bson_visit((uint8_t*)bson_data(&b), elem_visitor);                    
                
                //printf("Node/C99: sandboxed %02x %02x %02x\n", sandbox_id[0], sandbox_id[1], sandbox_id[2]);
                sandboxed_api_request_context(mist_api, sandbox_id, &b, sandboxed_response_cb, opts->mist);
                //sandboxed_api_request(mist_api, sandbox_id, &b, sandboxed_response_cb);
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


static void mist_app_periodic_cb_impl(void* ctx) {
    struct wish_app_core_opt* opts = (struct wish_app_core_opt*) ctx;
    mist_app_t* mist_app = opts->mist_app;
    mist_model_t* model = (mist_model_t*) &mist_app->model;
    
    if (pthread_mutex_trylock(&mutex1)) {
        //WISHDEBUG(LOG_CRITICAL, "Failed trylock. Fail-safe worked!");
        return;
    }
    
    if(node_api_plugin_kill) {
        //printf("killing loop from within.\n");
        //wish_core_client_close(mist_app->app);
        pthread_mutex_unlock(&mutex1);
        return;
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
                printf("### Wish Api requests are disabled in MistNodeApi\n");
                //wish_api_request(mist_app->app, &bs, mist_response_cb);
            } else if (input_type == 2) { // MIST
                printf("### MistApi call from a Node instance, this is not good!\n");
            } else if (input_type == 3) { // MIST NODE API
                //printf("MistNodeApi got message from node.js:\n");
                //bson_visit((uint8_t*)bson_data(&bs), elem_visitor);
                    
                bson_find_from_buffer(&it, input_buffer, "model");
                
                if(bson_iterator_type(&it) != BSON_EOO) {
                    //printf("model:\n");
                    //bson_visit( (uint8_t*)input_buffer, elem_visitor);
                    
                    bson_iterator_init(&it, &bs);
                    bson_find_fieldpath_value("model.device", &it);
                    if(bson_iterator_type(&it) != BSON_STRING) {
                        goto consume_and_unlock;
                    }
                    
                    //char* name = strdup(bson_iterator_string(&it));
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
                        
                        char* ep_type;
                        
                        if( bson_iterator_type(&epit) != BSON_STRING) {
                            ep_type = (char*) "";
                        } else {
                            ep_type = (char*) bson_iterator_string(&epit);
                        }
                        
                        char* ep_scale = NULL;
                        bson_iterator_subiterator(&modelit, &epit);
                        bson_find_fieldpath_value("scale", &epit);
                        if( bson_iterator_type(&epit) == BSON_STRING) {
                            ep_scale = (char*) bson_iterator_string(&epit);
                        }
                        
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
                        } else if ( strncmp(ep_type, "int", 16) == 0 ) {
                            //printf("An int.\n");
                            ep->type = MIST_TYPE_INT;
                            *((int*) ep->data) = 0;
                        } else if ( strncmp(ep_type, "bool", 16) == 0 ) {
                            //printf("A bool.\n");
                            ep->type = MIST_TYPE_BOOL;
                            *((bool*) ep->data) = false;
                        } else if (invokable) {
                            ep->type = MIST_TYPE_INVOKE;                            
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
                        ep->scaling = ep_scale;

                        
                        mist_add_ep(model, ep);
                        
                        //printf("ep_read %p %d\n", ep->read, ep->readable);
                        //printf("ep_write %p %d\n", ep->write, ep->writable);
                        //printf("ep_invoke %p %d\n", ep->invoke, ep->invokable);
                        //printf("ep_next %p\n", ep->next);
                        
                        c++;
                    }
                    
                    //mist_set_name(mist_app, name);
                } else {

                    bson_find_from_buffer(&it, input_buffer, "invoke");
                    
                    if (bson_iterator_type(&it) == BSON_INT) {
                        // this is a response to an invoke request
                        
                        /*
                         { invoke: request_id,
                           data: response_data } 
                        */
                        
                        int id = bson_iterator_int(&it);

                        mist_invoke_response(&mist_app->device_rpc_server, id, (uint8_t*) input_buffer);
                        goto consume_and_unlock;
                    }
                    
                    
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
                    } else if (ep->type == MIST_TYPE_INT) {
                        if (ep->data == NULL) { goto consume_and_unlock; }
                        
                        if ( bson_iterator_type(&it) == BSON_DOUBLE ) {
                            *((int*)ep->data) = (int) bson_iterator_double(&it);
                            mist_value_changed(model, ep_name);
                        } else if ( bson_iterator_type(&it) == BSON_INT ) {
                            *((int*)ep->data) = bson_iterator_int(&it);
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
            } else if (input_type == 4) { // MIST SANDBOXED API
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

static void* setupMistNodeApi(void* ptr) {
    struct wish_app_core_opt* opts = (struct wish_app_core_opt*) ptr;

    //printf("ip:port %s, %d\n", opts->ip, opts->port);

    // name used for WishApp and MistNode name
    char* name = (char*) (opts->name != NULL ? opts->name : "Node");

    //start wish apps
    mist_app_t* mist_app = opts->mist_app; // start_mist_app();
    opts->mist_app = mist_app;
    
    //printf("setupMistNodeApi has instance: %p\n", mist_app);

    mist_model_t* model = &(mist_app->model);
    
    model->custom_ui_url = (char*) "https://mist.controlthings.fi/mist-io-switch-0.0.2.tgz";
    
    mist_set_name(mist_app, name);
    
    wish_app_t* app = wish_app_create(name);
    opts->wish_app = app;
    
    if (app == NULL) {
        printf("Failed creating wish app\n");
        return NULL;
    }
    
    wish_app_add_protocol(app, &mist_app->ucp_handler);
    mist_app->app = app;
    
    app->periodic = mist_app_periodic_cb_impl;
    app->periodic_ctx = opts;

    app->port = opts->port;
    
    //printf("Starting libuv tcp client for NodeApi.\n");
    
    wish_core_client_init(app);
    
    return NULL;
}

static void* setupMistApi(void* ptr) {
    struct wish_app_core_opt* opts = (struct wish_app_core_opt*) ptr;
    
    //printf("ip:port %s, %d\n", opts->ip, opts->port);
    
    // name used for WishApp and MistNode name
    char* name = (char*) (opts->name != NULL ? opts->name : "MistApi");
    
    //start wish apps
    mist_app_t* mist_app = opts->mist_app; // start_mist_app();
    
    //printf("setupMistApi has instance: %p and Mist %p\n", mist_app, opts->mist);

    mist_set_name(mist_app, name);

    wish_app_t* app = wish_app_create((char*)name);
    opts->wish_app = app;

    if (app == NULL) {
        printf("Failed creating wish app\n");
        return NULL;
    }

    wish_app_add_protocol(app, &mist_app->ucp_handler);
    mist_app->app = app;
    
    //app->periodic = periodic_cb;
    //app->periodic_ctx = mist_app;
    
    app->port = opts->port;

    mist_api_t* api = mist_api_init(mist_app);
    opts->mist_api = api;

    api->periodic = mist_api_periodic_cb_impl;
    api->periodic_ctx = opts;

    //app->ready = init;
    
    wish_core_client_init(app);
    
    return NULL;
}

void mist_addon_start(Mist* mist) {
    wish_platform_set_malloc(malloc);
    
    int iret;

    struct wish_app_core_opt* opts = (struct wish_app_core_opt*) wish_platform_malloc(sizeof(struct wish_app_core_opt));
    
    DL_APPEND(wish_app_core_opts, opts);
    
    opts->mist = mist;
    
    opts->name = strdup(mist->name.c_str());
    opts->ip = strdup(mist->coreIp.c_str());
    opts->port = mist->corePort;
    
    /* Create independent threads each of which will execute function */
    
    // FIXME This is never freed!
    pthread_t* thread = (pthread_t*) wish_platform_malloc(sizeof(pthread_t));
    memset(thread, 0, sizeof(pthread_t));

    opts->mist_app = start_mist_app();

    if ( mist->apiType == 2 ) {
        //printf("mist_addon_start(setupMistApi, %s, core: %s:%d)\n", name, ip, port);
        iret = pthread_create(thread, NULL, setupMistApi, (void*) opts);
    } else if ( mist->apiType == 3 ) {
        //printf("mist_addon_start(setupMistNodeApi, %s, core: %s:%d)\n", name, ip, port);
        iret = pthread_create(thread, NULL, setupMistNodeApi, (void*) opts);
    } else if ( mist->apiType == 4 ) {
        //printf("mist_addon_start(setupMistNodeApi, %s, core: %s:%d)\n", name, ip, port);
        iret = pthread_create(thread, NULL, setupMistApi, (void*) opts);
    } else {
        printf("mist_addon_start received unrecognized type %i, (expecting 2, 3 or 4)\n", mist->apiType);
        exit(EXIT_FAILURE);
    }
    
    if (iret) {
        fprintf(stderr, "Error - pthread_create() return code: %d\n", iret);
        exit(EXIT_FAILURE);
    }
}
