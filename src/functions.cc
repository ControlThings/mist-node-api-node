#include "Mist.h"
#include "functions.h"
#include "app.h"
#include "mist_app.h"
#include "mist_api.h"
#include "mist_model.h"
#include "mist_handler.h"
#include "mist_follow.h"
#include "wish_core_client.h"
#include "wish_platform.h"
#include "wish_fs.h"
#include "fs_port.h"
#include "bson_visit.h"
#include "bson.h"
#include "utlist.h"

#include <pthread.h>
#include <stdio.h>
#include <string>

using namespace std;

typedef struct input_buffer_s {
    int len;
    int type;
    Mist* mist;
    char* data;
    struct input_buffer_s* next;
} input_buf;

struct wish_app_core_opt {
    Mist* mist;
    pthread_t* thread;
    bool node_api_plugin_kill;
    mist_api_t* mist_api;
    mist_app_t* mist_app;
    app_t* app;
    wish_app_t* wish_app;
    char* protocol;
    char* name;
    char* ip;
    int port;
    input_buf* input_queue;
    struct wish_app_core_opt* next;
};

struct wish_app_core_opt* wish_app_core_opts;

pthread_mutex_t mutex1 = PTHREAD_MUTEX_INITIALIZER;

#define SANDBOX_RPC_MSG_LEN_MAX     (16*1024)

static Mist* instance_by_mist_app(mist_app_t* mist_app) {
    if (mist_app == NULL) { return NULL; }
    
    struct wish_app_core_opt* opts;
    
    LL_FOREACH(wish_app_core_opts, opts) {
        if(opts->mist_app == mist_app) {
            return opts->mist;
            break;
        }
    }
    
    printf("instance_by_mist_app: Failed finding Mist instance. Pointer is: %p\n", mist_app);
    
    return NULL;
}

static Mist* instance_by_app(app_t* app) {
    if (app == NULL) { return NULL; }
    
    struct wish_app_core_opt* opts;
    
    LL_FOREACH(wish_app_core_opts, opts) {
        if(opts->app == app) {
            return opts->mist;
            break;
        }
    }
    
    printf("instance_by_app: Failed finding Mist instance. Pointer is: %p\n", app);
    
    return NULL;
}

bool injectMessage(Mist* mist, int type, uint8_t *msg, int len) {
    
    if (pthread_mutex_trylock(&mutex1)) {
        //printf("Unsuccessful injection lock.\n");
        return false;
    }

    struct wish_app_core_opt* app;

    bool found = false;
    
    LL_FOREACH(wish_app_core_opts, app) {
        if (app->mist == mist) {
            // got it!
            found = true;
            break;
        }
    }
    
    if (!found) { printf("injectMessage: App not found! Bailing!\n"); pthread_mutex_unlock(&mutex1); return false; }

    input_buf* in = (input_buf*) calloc(1, sizeof(input_buf));
    
    char* data = (char*) malloc(len);

    memcpy(data, msg, len);
    
    in->data = data;
    in->type = type;
    in->mist = mist;
    in->len = len;
    
    LL_APPEND(app->input_queue, in);

    // release lock   
    pthread_mutex_unlock(&mutex1);
    return true;
}

static void mist_response_cb(rpc_client_req* req, void* ctx, const uint8_t* data, size_t data_len) {
    
    if (req == NULL) {
        // regular request
    } else {
        // passthru request
        ctx = ((rpc_server_req *)ctx)->context;
    }
    
    Message msg("mist", (uint8_t*) data, data_len);
    
    Mist* mist = static_cast<Mist*>(ctx);
    //printf("mist_response_cb to Mist: %s\n", mist->name.c_str());
    mist->sendToNode(msg);
}

static void wish_response_cb(rpc_client_req* req, void* ctx, const uint8_t* data, size_t data_len) {
    if(ctx == NULL) {
        if (req->passthru_ctx2 != NULL) {
            ctx = req->passthru_ctx2;
        } else {
            //printf("NULL ctx in response going towards node.js. ctx %p\n", ctx);
            //bson_visit("NULL ctx request:", data);
            return;
        }
    }
    
    Message msg("wish", (uint8_t*) data, data_len);
    
    Mist* mist = static_cast<Mist*>(ctx);
    //printf("wish_response_cb to Mist: %s\n", mist->name.c_str());
    mist->sendToNode(msg);
}

static void sandboxed_response_cb(rpc_client_req* req, void* ctx, const uint8_t* data, size_t data_len) {
    //printf("sandboxed response going towards node.js. ctx %p req %p\n", ctx, req);
    //bson_visit("sandboxed response going towards node.js.", data);
    
    if (req == NULL) {
        // regular request
    } else {
        // request came from passthrough
        ctx = ((rpc_server_req *)ctx)->context;
    }
    
    Message msg("sandboxed", (uint8_t*) data, data_len);
    
    Mist* mist = static_cast<Mist*>(ctx);
    //printf("sandboxed_response_cb to Mist: %s\n", mist->name.c_str());
    mist->sendToNode(msg);
}

static enum mist_error hw_read(mist_ep* ep, wish_protocol_peer_t* peer, int id) {
    Mist* mist = instance_by_mist_app(ep->model->mist_app);
    
    if (mist == NULL) {
        printf("Failed finding mist instance to call... bailing out!\n");
        return MIST_ERROR;
    }
    // get full endpoint path
    char full_id[MIST_EPID_LEN] = {'\0'};
    mist_ep_full_epid(ep, full_id);
    
    bson b;
    bson_init_size(&b, 1024);
    
    if (peer) {
        bson_append_peer(&b, "peer", peer);
    }
    
    bson_append_start_object(&b, "read");
    bson_append_string(&b, "epid", full_id);
    bson_append_int(&b, "id", id);
    bson_append_finish_object(&b);
    bson_finish(&b);
    
    // epid args id
    
    Message msg("read", (uint8_t*) bson_data(&b), bson_size(&b));
    
    mist->sendToNode(msg);
    
    bson_destroy(&b);
    
    return MIST_NO_ERROR;
}

static enum mist_error hw_write(mist_ep* ep, wish_protocol_peer_t* peer, int id, bson* data) {
    Mist* mist = instance_by_mist_app(ep->model->mist_app);
    
    if (mist == NULL) {
        printf("Failed finding mist instance to call write... bailing out!\n");
        return MIST_ERROR;
    }
    
    // get full endpoint path
    char full_id[MIST_EPID_LEN] = {'\0'};
    mist_ep_full_epid(ep, full_id);
    
    bson_iterator args_it;
    // FIXME: Not sure this works for all data types
    if ( BSON_EOO == bson_find(&args_it, data, "args") ) { return MIST_ERROR; }
    
    bson bs;
    bson_init_size(&bs, 1024);

    bson_append_peer(&bs, "peer", peer);
    bson_append_start_object(&bs, "write");
    bson_append_string(&bs, "epid", full_id);
    bson_append_element(&bs, "args", &args_it);
    bson_append_int(&bs, "id", id);
    bson_append_finish_object(&bs);
    bson_finish(&bs);

    Message msg("write", (uint8_t*) bson_data(&bs), bson_size(&bs));
    
    mist->sendToNode(msg);

    bson_destroy(&bs);
    
    return MIST_NO_ERROR;
}

static enum mist_error hw_invoke(mist_ep* ep, wish_protocol_peer_t* peer, int id, bson* args) {
    //printf("in hw_invoke %p\n", ep->model->mist_app);
    Mist* mist = instance_by_mist_app(ep->model->mist_app);
    
    if (mist == NULL) {
        printf("Failed finding mist instance to call... bailing out!\n");
        return MIST_ERROR;
    }
    // get full endpoint path
    char full_id[MIST_EPID_LEN] = {'\0'};
    mist_ep_full_epid(ep, full_id);
    
    bson_iterator args_it;
    // FIXME: Not sure this works for all data types
    if ( BSON_EOO == bson_find(&args_it, args, "args") ) { return MIST_ERROR; }
    
    bson b;
    bson_init_size(&b, 1024);
    
    bson_append_peer(&b, "peer", peer);
    bson_append_start_object(&b, "invoke");
    bson_append_string(&b, "epid", full_id);
    bson_append_element(&b, "args", &args_it);
    bson_append_int(&b, "id", id);
    bson_append_finish_object(&b);
    bson_finish(&b);
    
    // epid args id
    
    Message msg("invoke", (uint8_t*) bson_data(&b), bson_size(&b));
    
    mist->sendToNode(msg);
    
    bson_destroy(&b);
    
    return MIST_NO_ERROR;
}

static void online(app_t* app, wish_protocol_peer_t* peer) {
    Mist* mist = instance_by_app(app);
    
    if (mist == NULL) {
        printf("Failed finding mist instance to call write... bailing out!\n");
        return;
    }
    
    bson bs;
    bson_init(&bs);
    bson_append_peer(&bs, "peer", peer);
    bson_finish(&bs);
    
    if (bs.err) { printf("Error producing bson!! %d\n", bs.err); }

    Message msg("online", (uint8_t*) bson_data(&bs), bson_size(&bs));
    
    //printf("online to Mist: %s\n", mist->name.c_str());
    mist->sendToNode(msg);
    bson_destroy(&bs);
}

static void offline(app_t* app, wish_protocol_peer_t* peer) {
    Mist* mist = instance_by_app(app);
    
    if (mist == NULL) {
        printf("Failed finding mist instance to call write... bailing out!\n");
        return;
    }
    
    bson bs;
    bson_init(&bs);
    bson_append_peer(&bs, "peer", peer);
    bson_finish(&bs);

    Message msg("offline", (uint8_t*) bson_data(&bs), bson_size(&bs));

    //printf("offline to Mist: %s\n", mist->name.c_str());
    mist->sendToNode(msg);
    bson_destroy(&bs);
}

static void mist_online(mist_app_t* mist_app, wish_protocol_peer_t* peer) {
    //WISHDEBUG(LOG_CRITICAL, "mist_online %s %p", mist_app->name, peer);
    
    Mist* mist = instance_by_mist_app(mist_app);
    
    if (mist == NULL) {
        printf("Failed finding mist instance to call write... bailing out!\n");
        return;
    }
    
    bson bs;
    bson_init(&bs);
    bson_append_peer(&bs, "peer", peer);
    bson_finish(&bs);
    
    if (bs.err) { printf("Error producing bson!! %d\n", bs.err); }

    Message msg("online", (uint8_t*) bson_data(&bs), bson_size(&bs));
    
    //printf("online to Mist: %s\n", mist->name.c_str());
    mist->sendToNode(msg);
    bson_destroy(&bs);
}

static void mist_offline(mist_app_t* mist_app, wish_protocol_peer_t* peer) {
    //WISHDEBUG(LOG_CRITICAL, "mist_offline %s %p", mist_app->name, peer);

    Mist* mist = instance_by_mist_app(mist_app);
    
    if (mist == NULL) {
        printf("Failed finding mist instance to call write... bailing out!\n");
        return;
    }
    
    bson bs;
    bson_init(&bs);
    bson_append_peer(&bs, "peer", peer);
    bson_finish(&bs);

    Message msg("offline", (uint8_t*) bson_data(&bs), bson_size(&bs));

    //printf("offline to Mist: %s\n", mist->name.c_str());
    mist->sendToNode(msg);
    bson_destroy(&bs);
}

static void frame(app_t* app, const uint8_t* payload, size_t payload_len, wish_protocol_peer_t* peer) {
    Mist* mist = instance_by_app(app);
    
    if (mist == NULL) {
        printf("Failed finding mist instance to call write... bailing out!\n");
        return;
    }
    
    bson bs;
    bson_init(&bs);
    bson_append_binary(&bs, "frame", (char*) payload, payload_len);
    bson_append_peer(&bs, "peer", peer);
    bson_finish(&bs);

    if (bs.err) { printf("Error producing bson!! %d\n", bs.err); }
    
    Message msg("frame", (uint8_t*) bson_data(&bs), bson_size(&bs));
    
    //printf("frame to Mist: %s\n", mist->name.c_str());
    mist->sendToNode(msg);
    bson_destroy(&bs);
}

static void wish_periodic_cb_impl(void* ctx) {
    struct wish_app_core_opt* opts = (struct wish_app_core_opt*) ctx;

    if (opts->app == NULL) {
        WISHDEBUG(LOG_CRITICAL, "There is no WishApp in wish_periodic here! Broken? opts->app: %p", opts->app);
        return;
    }
    
    if (pthread_mutex_trylock(&mutex1)) {
        return;
    }
    
    if(opts->node_api_plugin_kill) {
        //printf("killing loop from within.\n");
        wish_core_client_close(opts->wish_app);
        pthread_mutex_unlock(&mutex1);
        return;
    }
    
    input_buf* msg = opts->input_queue;
    
    // check if we can inject a new message, i.e input buffer is consumed by Mist
    while (msg != NULL) {

        if(opts->mist != msg->mist) {
            printf("This message is NOT for this instance of Mist!! this: %p was for %p\n", opts->mist, msg->mist);
            pthread_mutex_unlock(&mutex1);
            return;
        } else {
            //printf("Right Mist!! this: %p was for %p\n", opts->mist, mistInst);
        }

        bson_iterator it;
        bson_find_from_buffer(&it, msg->data, "kill");
        
        if (bson_iterator_type(&it) == BSON_BOOL) {
            //printf("kill is bool\n");
            if (bson_iterator_bool(&it)) {
                //printf("kill is true\n");
                opts->node_api_plugin_kill = true;
            }
        } else {
            bson bs;
            bson_init_with_data(&bs, msg->data);
            
            if(msg->type == 1) { // WISH
                bson_iterator it;
                bson_find(&it, &bs, "cancel");

                if (bson_iterator_type(&it) == BSON_INT) {
                    //printf("wish_cancel %i\n", bson_iterator_int(&it));
                    wish_core_request_cancel(opts->wish_app, bson_iterator_int(&it));
                    goto consume_and_unlock;
                }

                wish_app_request_passthru(opts->wish_app, &bs, wish_response_cb, opts->mist);
            }
        }
        
consume_and_unlock:
        
        LL_DELETE(opts->input_queue, msg);
        free(msg->data);
        free(msg);
        
        // TODO: What does this do?
        msg = opts->input_queue;
        
    }

    // release lock   
    pthread_mutex_unlock(&mutex1);
}

static char* endpoint_path_from_model(const char* id) {
    if ( strnlen(id, 255) >= 255 ) { return NULL; }
    
    const char str[] = ".#";
    int str_len = 2;
    int cursor = 0;
    char* out = (char*) malloc(256);
    memset(out, 0, 256);
    int out_cursor = 0;
    char* tmp = NULL;
    char* end = NULL;
    
    int i;
    bool first = true;

    for (i=0; (tmp = (char*) strstr(&id[cursor], str)); i++) {
        if (first) {
            *tmp = '\0';
            strcpy(&out[out_cursor], &id[cursor]);
            out_cursor += strlen(&id[cursor]);
            *tmp = '.';
            
            first = false;
        }
        cursor = tmp - id + str_len;
        end = (char*) strstr(&id[cursor], str);
        if (end != NULL) { *end = '\0'; }
        if (end != NULL) {
            strcpy(&out[out_cursor], &id[cursor]);
            out_cursor += strlen(&id[cursor]);
        }
        if (end != NULL) { *end = '.'; }
    }

    if (first) {
        free(out);
        return NULL;
    }
    
    return out;
}

static void mist_add_ep_bson(mist_app_t* mist_app, const bson* ep_bson) {
    mist_model* model = &mist_app->model;

    bson_iterator it;
    bson_iterator_init(&it, ep_bson);
    
    const char* parent = NULL;

    bson_iterator_init(&it, ep_bson);
    bson_find_fieldpath_value("ep.parent", &it);
    if( bson_iterator_type(&it) == BSON_STRING) { parent = bson_iterator_string(&it); }

    const char* epid = NULL;
    
    bson_iterator_init(&it, ep_bson);
    bson_find_fieldpath_value("ep.epid", &it);
    if( bson_iterator_type(&it) == BSON_STRING) { epid = bson_iterator_string(&it); }


    const char* ep_label = NULL;

    bson_iterator_init(&it, ep_bson);
    bson_find_fieldpath_value("ep.label", &it);
    if( bson_iterator_type(&it) != BSON_STRING) {
        ep_label = epid;
    } else {
        ep_label = bson_iterator_string(&it);
    }

    bson_iterator_init(&it, ep_bson);
    bson_find_fieldpath_value("ep.type", &it);

    char* ep_type;

    if( bson_iterator_type(&it) != BSON_STRING) {
        return;
    } else {
        ep_type = (char*) bson_iterator_string(&it);
    }

    char* ep_scale = NULL;
    bson_iterator_init(&it, ep_bson);
    bson_find_fieldpath_value("ep.scale", &it);
    if( bson_iterator_type(&it) == BSON_STRING) {
        ep_scale = (char*) bson_iterator_string(&it);
    }

    bool readable = false;

    // read: true
    bson_iterator_init(&it, ep_bson);
    bson_find_fieldpath_value("ep.read", &it);
    if( bson_iterator_type(&it) == BSON_BOOL) {
        if ( bson_iterator_bool(&it) ) {
            readable = true;
        }
    }

    bool writable = false;

    bson_iterator_init(&it, ep_bson);
    bson_find_fieldpath_value("ep.write", &it);
    if( bson_iterator_type(&it) == BSON_BOOL) {
        writable = bson_iterator_bool(&it);
    }

    bool invokable = false;

    bson_iterator_init(&it, ep_bson);
    bson_find_fieldpath_value("ep.invoke", &it);
    if( bson_iterator_type(&it) != BSON_EOO) {
        invokable = true;
    }

    // allocate a new endpoint and space for data
    mist_ep* ep = (mist_ep*) malloc(sizeof(mist_ep));
    if (ep == NULL) { return; }
    memset(ep, 0, sizeof(mist_ep));

    ep->id = strdup(epid);
    ep->label = strdup(ep_label);

    if ( strncmp(ep_type, "float", 16) == 0 ) {
        ep->type = MIST_TYPE_FLOAT;
    } else if ( strncmp(ep_type, "int", 16) == 0 ) {
        ep->type = MIST_TYPE_INT;
    } else if ( strncmp(ep_type, "bool", 16) == 0 ) {
        ep->type = MIST_TYPE_BOOL;
    } else if ( strncmp(ep_type, "string", 16) == 0 ) {
        ep->type = MIST_TYPE_STRING;
    } else if (invokable) {
        ep->type = MIST_TYPE_INVOKE;                            
    } else {
         return;
    }

    if (readable) { ep->read = hw_read; }
    if (writable) { ep->write = hw_write; }
    if (invokable) { ep->invoke = hw_invoke; }
    ep->unit = NULL;
    ep->next = NULL;
    ep->prev = NULL;
    ep->dirty = false;
    ep->scaling = ep_scale;

    mist_ep_add(model, parent, ep);
}

static bson_visitor_cmd_t mist_model_build_visitor(
        const char *ipath, int ipathlen, 
        const char *key, int keylen,
        const bson_iterator *it, 
        bool after, void *op) 
{
    mist_model* model = (mist_model*) op;
    
    char tpath[128];
    memcpy(tpath, ipath, ipathlen);
    tpath[ipathlen] = 0;
    
    char tkey[128];
    memcpy(tkey, key, keylen);
    tkey[keylen] = 0;
    
    if (!after) {
        bson_iterator epit;

        bool has_children = false;
        
        bson_iterator_subiterator(it, &epit);
        bson_find_fieldpath_value("#", &epit);
        if( bson_iterator_type(&epit) == BSON_OBJECT) {
            has_children = true;
        }
        
        const char* ep_label = NULL;
        
        bson_iterator_subiterator(it, &epit);
        bson_find_fieldpath_value("label", &epit);
        if( bson_iterator_type(&epit) != BSON_STRING) {
            ep_label = key;
        } else {
            ep_label = bson_iterator_string(&epit);
        }

        bson_iterator_subiterator(it, &epit);
        bson_find_fieldpath_value("type", &epit);

        char* ep_type;

        if( bson_iterator_type(&epit) != BSON_STRING) {
            return BSON_VCMD_OK;
        } else {
            ep_type = (char*) bson_iterator_string(&epit);
        }

        char* ep_scale = NULL;
        bson_iterator_subiterator(it, &epit);
        bson_find_fieldpath_value("scale", &epit);
        if( bson_iterator_type(&epit) == BSON_STRING) {
            ep_scale = (char*) bson_iterator_string(&epit);
        }

        bool readable = false;

        // data: _anything_
        bson_iterator_subiterator(it, &epit);
        bson_find_fieldpath_value("data", &epit);
        if( bson_iterator_type(&epit) != BSON_EOO) {
            readable = true;
        }

        // read: true
        bson_iterator_subiterator(it, &epit);
        bson_find_fieldpath_value("read", &epit);
        if( bson_iterator_type(&epit) == BSON_BOOL) {
            if ( bson_iterator_bool(&epit) ) {
                readable = true;
            }
        }

        bool writable = false;

        bson_iterator_subiterator(it, &epit);
        bson_find_fieldpath_value("write", &epit);
        if( bson_iterator_type(&epit) == BSON_BOOL) {
            writable = bson_iterator_bool(&epit);
        }

        bool invokable = false;

        bson_iterator_subiterator(it, &epit);
        bson_find_fieldpath_value("invoke", &epit);
        if( bson_iterator_type(&epit) != BSON_EOO) {
            invokable = true;
        }
        
        // allocate a new endpoint and space for data
        mist_ep* ep = (mist_ep*) malloc(sizeof(mist_ep));
        if (ep == NULL) { return BSON_VCMD_TERMINATE; }
        memset(ep, 0, sizeof(mist_ep));

        ep->id = strdup(key);
        ep->label = strdup(ep_label);
        
        if ( strncmp(ep_type, "float", 16) == 0 ) {
            ep->type = MIST_TYPE_FLOAT;
        } else if ( strncmp(ep_type, "int", 16) == 0 ) {
            ep->type = MIST_TYPE_INT;
        } else if ( strncmp(ep_type, "bool", 16) == 0 ) {
            ep->type = MIST_TYPE_BOOL;
        } else if ( strncmp(ep_type, "string", 16) == 0 ) {
            ep->type = MIST_TYPE_STRING;
        } else if (invokable) {
            ep->type = MIST_TYPE_INVOKE;                            
        } else {
             return BSON_VCMD_OK;
        }

        if (readable) { ep->read = hw_read; }
        if (writable) { ep->write = hw_write; }
        if (invokable) { ep->invoke = hw_invoke; }
        ep->unit = NULL;
        ep->next = NULL;
        ep->prev = NULL;
        ep->dirty = false;
        ep->scaling = ep_scale;

        char* parent = endpoint_path_from_model(tpath+6);
        
        mist_ep_add(model, parent, ep);
        
        if ( parent != NULL ) { free(parent); }
        
        return has_children ? BSON_VCMD_OK : BSON_VCMD_SKIP_NESTED;
    }

    return BSON_VCMD_OK;
}

static void mist_model_parse(const bson* from, mist_model* model) {
    bson_iterator i;
    bson_iterator_init(&i, from);

    bson_visit_fields(&i, (bson_traverse_flags_t) 0, mist_model_build_visitor, model);
}

static void mist_node_api_callback(rpc_client_req* req, void *ctx, const uint8_t* payload, size_t payload_len) {
    //printf("mist_node_api_callback: %i %i\n", req->id, req->passthru_id);
    Mist* mist = instance_by_mist_app( (mist_app_t*) req->passthru_ctx );
    
    if (mist == NULL) { return; }
    
    bson_iterator it;
    if (BSON_INT != bson_find_from_buffer(&it, (const char*)payload, "ack") ) {
        if (BSON_INT != bson_find_from_buffer(&it, (const char*)payload, "sig") ) {
            if (BSON_INT != bson_find_from_buffer(&it, (const char*)payload, "err") ) {
                // if not ack, sig or err, just bail
                bson_visit("mist_node_api_callback got mysterious message (no, ack, sig or err present)", payload);
                return;
           }
        }
    }
    
    // warning! writing to the const char* payload
    bson_inplace_set_long(&it, req->passthru_id);

    Message msg("mistnode", (uint8_t*) payload, (int) payload_len);

    mist->sendToNode(msg);
}

static void mist_node_api_handler(mist_app_t* mist_app, input_buf* msg) {
    mist_model* model = &mist_app->model;

    bson_iterator it;

    // model
    if (BSON_EOO != bson_find_from_buffer(&it, msg->data, "model")) {
        bson bs;
        bson_init_with_data(&bs, msg->data);
        mist_model_parse(&bs, model);
        return;
    }

    // endpointAdd
    if (BSON_EOO != bson_find_from_buffer(&it, msg->data, "endpointAdd")) {
        bson bs;
        bson_init_with_data(&bs, msg->data);
        
        mist_add_ep_bson(mist_app, &bs);
        return;
    }

    // endpointRemove
    if (BSON_STRING == bson_find_from_buffer(&it, msg->data, "endpointRemove")) {
        
        mist_ep_remove(model, bson_iterator_string(&it));
        return;
    }

    // read response
    /*
     { read: request_id,
       epid: String,
       data: response_data } 
    */
    if (BSON_INT == bson_find_from_buffer(&it, msg->data, "read")) {
        int id = bson_iterator_int(&it);
        if (BSON_STRING != bson_find_from_buffer(&it, msg->data, "epid")) { return; }

        bson b;
        bson_init_with_data(&b, msg->data);
        mist_read_response(mist_app, bson_iterator_string(&it), id, &b);
        return;
    }

    if (BSON_INT == bson_find_from_buffer(&it, msg->data, "readError")) {
        int id = bson_iterator_int(&it);
        if (BSON_STRING != bson_find_from_buffer(&it, msg->data, "epid")) { return; }
        const char* epid = bson_iterator_string(&it);
        if (BSON_INT != bson_find_from_buffer(&it, msg->data, "code")) { return; }
        int code = bson_iterator_int(&it);
        if (BSON_STRING != bson_find_from_buffer(&it, msg->data, "msg")) { return; }
        const char* msg = bson_iterator_string(&it);

        mist_read_error(mist_app, epid, id, code, msg);
        return;
    }

    // write response
    /*
     { write: request_id,
       epid: String } 
    */
    if (BSON_INT == bson_find_from_buffer(&it, msg->data, "write")) {
        int id = bson_iterator_int(&it);
        if (BSON_STRING != bson_find_from_buffer(&it, msg->data, "epid")) { return; }

        mist_write_response(mist_app, bson_iterator_string(&it), id);
        return;
    }

    if (BSON_INT == bson_find_from_buffer(&it, msg->data, "writeError")) {
        int id = bson_iterator_int(&it);
        if (BSON_STRING != bson_find_from_buffer(&it, msg->data, "epid")) { return; }
        const char* epid = bson_iterator_string(&it);
        if (BSON_INT != bson_find_from_buffer(&it, msg->data, "code")) { return; }
        int code = bson_iterator_int(&it);
        if (BSON_STRING != bson_find_from_buffer(&it, msg->data, "msg")) { return; }
        const char* msg = bson_iterator_string(&it);

        mist_write_error(mist_app, epid, id, code, msg);
        return;
    }

    // invoke response
    /*
     { invoke: request_id,
       epid: String,
       data: response_data } 
    */
    if (BSON_INT == bson_find_from_buffer(&it, msg->data, "invoke")) {
        int id = bson_iterator_int(&it);

        if (BSON_STRING != bson_find_from_buffer(&it, msg->data, "epid")) { return; }

        bson b;
        bson_init_with_data(&b, msg->data);

        mist_invoke_response(mist_app, bson_iterator_string(&it), id, &b);
        return;
    }

    if (BSON_INT == bson_find_from_buffer(&it, msg->data, "invokeError")) {
        int id = bson_iterator_int(&it);
        if (BSON_STRING != bson_find_from_buffer(&it, msg->data, "epid")) { return; }
        const char* epid = bson_iterator_string(&it);
        if (BSON_INT != bson_find_from_buffer(&it, msg->data, "code")) { return; }
        int code = bson_iterator_int(&it);
        if (BSON_STRING != bson_find_from_buffer(&it, msg->data, "msg")) { return; }
        const char* msg = bson_iterator_string(&it);

        mist_invoke_error(mist_app, epid, id, code, msg);
        return;
    }

    if (BSON_STRING == bson_find_from_buffer(&it, msg->data, "changed")) {
        /*
         { changed: epid } 
        */
        const char* epid = bson_iterator_string(&it);

        mist_value_changed(mist_app, epid);
        return;
    }

    if (BSON_STRING == bson_find_from_buffer(&it, msg->data, "op")) {
        /*
         { peer: { luid, ruid... }, op: string, args: [arg1, arg2, ...], id: n }
        */

        if (BSON_INT != bson_find_from_buffer(&it, msg->data, "id")) {
            WISHDEBUG(LOG_CRITICAL, "mist_node_api_handler: id is not BSON_INT but: %i", bson_iterator_type(&it));
            return;
        }
        int id = bson_iterator_int(&it);

        //const char* op = bson_iterator_string(&it);

        if (BSON_OBJECT != bson_find_from_buffer(&it, msg->data, "peer")) {
            WISHDEBUG(LOG_CRITICAL, "peer is not object but %i", bson_iterator_type(&it));
            return;
        }

        wish_protocol_peer_t peer;
        
        bool success = wish_protocol_peer_populate_from_bson(&peer, (const uint8_t*)bson_iterator_value(&it));
        
        if (!success) { bson_visit("Failed to populate peer from bson:", (const uint8_t*)bson_iterator_value(&it)); return; }
        
        bson req;
        bson_init_with_data(&req, msg->data);
        bson_find(&it, &req, "id");
        if (BSON_INT != bson_iterator_type(&it)) {
            WISHDEBUG(LOG_CRITICAL, "Failed replacing id in mist_node_api request.");
            return;
        }
        bson_inplace_set_long(&it, 0);
        
        rpc_client_req* creq = mist_app_request(mist_app, &peer, &req, mist_node_api_callback);

        if (creq == NULL) {
            WISHDEBUG(LOG_CRITICAL, "Failed making request.");
            return;
        }
        creq->passthru_id = id;
        creq->passthru_ctx = mist_app;

        return;
    }
}

static void mist_sandboxed_api_handler(struct wish_app_core_opt* opts, input_buf* msg) {
    mist_api_t* mist_api = opts->mist_api;

    bson bs;
    bson_init_with_data(&bs, msg->data);

    const char* sandbox_id = "";

    bson_iterator it;

    bson_find_from_buffer(&it, msg->data, "cancel");

    if (bson_iterator_type(&it) == BSON_INT) {
        int id = bson_iterator_int(&it);

        //printf("Node/C99: sandboxed_cancel %i\n", id);                    

        bson_find_from_buffer(&it, msg->data, "sandbox");

        if ( bson_iterator_type(&it) == BSON_BINDATA && bson_iterator_bin_len(&it) == 32 ) {
            // found the sandbox_id
            sandbox_id = (char*) bson_iterator_bin_data(&it);
        } else {
            printf("Invalid sandbox id. 5 != %i || 32 != %i\n", bson_iterator_type(&it), bson_iterator_bin_len(&it));
        }

        sandboxed_api_request_cancel(mist_api, sandbox_id, id);
        return;
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
    if ( BSON_ARRAY != bson_find(&ait, &bs, "args") ) {
        bson_visit("sandbox args not array", (const uint8_t*) bson_data(&bs));
        bson_destroy(&b);
        return;
    }

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
        return;
    }

    int i;
    int args_len = 0;

    bson_append_start_array(&b, "args");

    // Only single digit array index supported. 
    //   i.e Do not exceed 8 with the index. Rewrite indexing if you must!
    for(i=0; i<9; i++) {
        char src[21];
        char dst[21];

        BSON_NUMSTR(src, i+1);
        BSON_NUMSTR(dst, i);

        // init the sub iterator from args array iterator
        bson_iterator_subiterator(&ait, &sit);

        // read the argument
        //bson_find(&it, req, src);
        bson_type type = bson_find_fieldpath_value(src, &sit);

        if (type == BSON_EOO) {
            break;
        } else {
            bson_append_element(&b, dst, &sit);
        }
        
        args_len++;
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

static void mist_api_periodic_cb_impl(void* ctx) {
    struct wish_app_core_opt* opts = (struct wish_app_core_opt*) ctx;

    if (opts->mist_api == NULL) {
        WISHDEBUG(LOG_CRITICAL, "There is no MistApi in mist_api_periodic_cb_impl, is this a pure wish-app? %p", opts->app);
        return;
    }
    
    mist_api_t* mist_api = opts->mist_api;
    mist_app_t* mist_app = opts->mist_app;

    if (pthread_mutex_trylock(&mutex1)) { return; }
    
    if(opts->node_api_plugin_kill) {
        // killing loop from within
        wish_core_client_close(mist_api->wish_app);
        pthread_mutex_unlock(&mutex1);
        return;
    }
    
    input_buf* msg = opts->input_queue;
    
    // check if we can inject a new message, i.e input buffer is consumed by Mist
    while (msg != NULL) {
        
        if(opts->mist != msg->mist) {
            //printf("This message is NOT for this instance of Mist!! this: %p was for %p\n", opts->mist, mistInst);
            pthread_mutex_unlock(&mutex1);
            return;
        }
        
        bson_iterator it;
        bson_find_from_buffer(&it, msg->data, "kill");
        
        if (bson_iterator_type(&it) == BSON_BOOL) {
            if (bson_iterator_bool(&it)) {
                opts->node_api_plugin_kill = true;
            }
        } else {
            bson bs;
            bson_init_with_data(&bs, msg->data);

            if(msg->type == 1) { // WISH
                bson_iterator it;
                bson_find(&it, &bs, "cancel");

                if (bson_iterator_type(&it) == BSON_INT) {
                    //printf("wish_cancel %i\n", bson_iterator_int(&it));
                    wish_api_request_cancel(mist_api, bson_iterator_int(&it));
                    goto consume_and_unlock;
                }

                //printf("Making wish_api_request\n");
                //bson_visit("Making wish_api_request bson data:", (uint8_t*)bson_data(&bs));
                
                wish_api_request_context(mist_api, &bs, wish_response_cb, opts->mist);
                
                /*
                rpc_client_req* req = wish_app_request(mist_api->wish_app, &bs, wish_response_cb, opts->mist);
                
                if (req == NULL) {
                    WISHDEBUG(LOG_CRITICAL, "Request failed...");
                    goto consume_and_unlock;
                }
                */
                
                
            } else if (msg->type == 2) { // MIST
                //printf("### Mist\n");
                
                bson_iterator it;
                bson_find_from_buffer(&it, msg->data, "cancel");

                if (bson_iterator_type(&it) == BSON_INT) {
                    //printf("mist_cancel %i\n", bson_iterator_int(&it));
                    mist_api_request_cancel(mist_api, bson_iterator_int(&it));
                    goto consume_and_unlock;
                }
                
                //printf("Mist going into request context: %p cb %p\n", opts->mist, mist_response_cb);
                mist_api_request_context(mist_api, &bs, mist_response_cb, opts->mist);
            } else if (msg->type == 3) { // MIST NODE API
                mist_node_api_handler(mist_app, msg);
            } else if (msg->type == 4) { // MIST SANDBOXED API
                //printf("### Sandboxed Api\n");
                //bson_visit("sandbox_api-request:", (uint8_t*)bson_data(&bs));
                
                mist_sandboxed_api_handler(opts, msg);
            }
        }
        
consume_and_unlock:
        LL_DELETE(opts->input_queue, msg);
        free(msg->data);
        free(msg);
        msg = opts->input_queue;
    }

    // release lock   
    pthread_mutex_unlock(&mutex1);
}


static void mist_app_periodic_cb_impl(void* ctx) {
    struct wish_app_core_opt* opts = (struct wish_app_core_opt*) ctx;
    mist_app_t* mist_app = opts->mist_app;
    
    if (pthread_mutex_trylock(&mutex1)) { return; }
    
    if(opts->node_api_plugin_kill) {
        // killing loop from within
        wish_core_client_close(mist_app->app);
        pthread_mutex_unlock(&mutex1);
        return;
    }

    input_buf* msg = opts->input_queue;
    
    // check if we can inject a new message, i.e input buffer is consumed by Mist
    while (msg != NULL) {
        bson_iterator it;
        bson_find_from_buffer(&it, msg->data, "kill");
        
        if (bson_iterator_type(&it) == BSON_BOOL) {
            if (bson_iterator_bool(&it)) {
                opts->node_api_plugin_kill = true;
            }
        } else {
            if(msg->type == 1) { // WISH
                bson bs;
                bson_init_with_data(&bs, msg->data);
                
                bson_iterator it;
                bson_find(&it, &bs, "cancel");

                if (bson_iterator_type(&it) == BSON_INT) {
                    wish_core_request_cancel(opts->wish_app, bson_iterator_int(&it));
                } else {
                    wish_app_request_passthru(opts->wish_app, &bs, wish_response_cb, opts->mist);
                }
            } else if (msg->type == 2) { // MIST
                printf("### MistApi call from a Node instance, this is not good!\n");
            } else if (msg->type == 3) { // MIST NODE API
                mist_node_api_handler(mist_app, msg);
            } else if (msg->type == 4) { // MIST SANDBOXED API
                //printf("Sandbox commands not handeled in MistNodeApi.");
            }
        }

        // consume message
        LL_DELETE(opts->input_queue, msg);
        free(msg->data);
        free(msg);
        
        // take next message from queue
        msg = opts->input_queue;
    }

    // release lock   
    pthread_mutex_unlock(&mutex1);
}

static void* setupMistNodeApi(void* ptr) {
    struct wish_app_core_opt* opts = (struct wish_app_core_opt*) ptr;

    // name used for WishApp and MistNode name
    char* name = (char*) (opts->name != NULL ? opts->name : "Node");

    //start wish apps
    mist_app_t* mist_app = opts->mist_app; // start_mist_app();
    opts->mist_app = mist_app;
    
    wish_app_t* app = wish_app_create(name);
    opts->wish_app = app;
    
    if (app == NULL) {
        printf("Failed creating wish app\n");
        return NULL;
    }
    
    wish_app_add_protocol(app, &mist_app->protocol);
    mist_app->app = app;
    
    mist_app->online = mist_online;
    mist_app->offline = mist_offline;
    
    app->periodic = mist_app_periodic_cb_impl;
    app->periodic_ctx = opts;

    app->port = opts->port;
    
    wish_core_client_init(app);

    //printf("libuv loop closed and thread ended (setupMistNodeApi)\n");

    // when core_client returns clean up 
    opts->mist = NULL;
    opts->app = NULL;
    opts->mist_app = NULL;
    opts->mist_api = NULL;
    
    return NULL;
}

static void* setupMistApi(void* ptr) {
    struct wish_app_core_opt* opts = (struct wish_app_core_opt*) ptr;
    
    // name used for WishApp and MistNode name
    char* name = (char*) (opts->name != NULL ? opts->name : "MistApi");
    
    //start wish apps
    mist_app_t* mist_app = opts->mist_app; // start_mist_app();
    
    wish_app_t* app = wish_app_create((char*)name);
    opts->wish_app = app;

    if (app == NULL) {
        printf("Failed creating wish app\n");
        return NULL;
    }

    wish_app_add_protocol(app, &mist_app->protocol);
    mist_app->app = app;
    
    app->port = opts->port;

    mist_api_t* api = mist_api_init(mist_app);
    opts->mist_api = api;

    api->periodic = mist_api_periodic_cb_impl;
    api->periodic_ctx = opts;

    wish_core_client_init(app);

    //printf("libuv loop closed and thread ended (setupMistApi)\n");

    // when core_client returns clean up 
    opts->mist = NULL;
    opts->app = NULL;
    opts->mist_app = NULL;
    opts->mist_api = NULL;
    
    return NULL;
}

static void* setupWishApi(void* ptr) {
    struct wish_app_core_opt* opts = (struct wish_app_core_opt*) ptr;
    
    // name used for WishApp and MistNode name
    char* name = (char*) (opts->name != NULL ? opts->name : "WishApi");
    
    app_t* app = opts->app;

    //mist_set_name(mist_app, name);

    wish_app_t* wish_app = wish_app_create((char*)name);
    
    if (wish_app == NULL) {
        printf("Failed creating wish app\n");
        return NULL;
    }
    
    opts->wish_app = wish_app;
    
    if (opts->protocol && strnlen(opts->protocol, 1) != 0) {
        //printf("we have a protocol here.... %s\n", opts->protocol);
        memcpy(app->protocol.protocol_name, opts->protocol, WISH_PROTOCOL_NAME_MAX_LEN);
        wish_app_add_protocol(wish_app, &app->protocol);
    }
    
    app->app = wish_app;

    app->online = online;
    app->offline = offline;
    app->frame = frame;
    
    wish_app->port = opts->port;

    wish_app->periodic = wish_periodic_cb_impl;
    wish_app->periodic_ctx = opts;

    wish_core_client_init(wish_app);
    
    //printf("libuv loop closed and thread ended (setupWishApi)\n");

    // when core_client returns clean up 
    opts->mist = NULL;
    opts->app = NULL;
    opts->mist_app = NULL;
    opts->mist_api = NULL;
    
    free(opts->name);
    free(opts->protocol);
    free(opts->ip);
    
    free(opts);
    
    return NULL;
}

void mist_addon_start(Mist* mist) {
    //printf("mist_addon_start(Mist* %p)\n", mist);
    // Initialize wish_platform functions
    wish_platform_set_malloc(malloc);
    wish_platform_set_realloc(realloc);
    wish_platform_set_free(free);
    srandom(time(NULL));
    wish_platform_set_rng(random);
    wish_platform_set_vprintf(vprintf);
    wish_platform_set_vsprintf(vsprintf);    
    
    /* File system functions are needed for Mist mappings! */
    wish_fs_set_open(my_fs_open);
    wish_fs_set_read(my_fs_read);
    wish_fs_set_write(my_fs_write);
    wish_fs_set_lseek(my_fs_lseek);
    wish_fs_set_close(my_fs_close);
    wish_fs_set_rename(my_fs_rename);
    wish_fs_set_remove(my_fs_remove);    
    
    int iret;

    struct wish_app_core_opt* opts = (struct wish_app_core_opt*) wish_platform_malloc(sizeof(struct wish_app_core_opt));
    memset(opts, 0, sizeof(struct wish_app_core_opt));
    
    LL_PREPEND(wish_app_core_opts, opts);
    
    opts->mist = mist;
    
    opts->protocol = strdup(mist->protocol.c_str());
    
    opts->name = strdup(mist->name.c_str());
    opts->ip = strdup(mist->coreIp.c_str());
    opts->port = mist->corePort;
    
    /* Create independent threads each of which will execute function */
    
    // FIXME This is never freed!
    opts->thread = (pthread_t*) wish_platform_malloc(sizeof(pthread_t));
    memset(opts->thread, 0, sizeof(pthread_t));

    if ( mist->apiType == Mist::ApiType::ApiTypeMist ) {
        //printf("mist_addon_start(setupMistApi, %s, core: %s:%d)\n", opts->name, opts->ip, opts->port);
        opts->mist_app = start_mist_app();
        opts->app = NULL;
        iret = pthread_create(opts->thread, NULL, setupMistApi, (void*) opts);
    } else if ( mist->apiType == Mist::ApiType::ApiTypeMistNode ) {
        //printf("mist_addon_start(setupMistNodeApi, %s, core: %s:%d)\n", opts->name, opts->ip, opts->port);
        opts->mist_app = start_mist_app();
        opts->app = NULL;
        iret = pthread_create(opts->thread, NULL, setupMistNodeApi, (void*) opts);
    } else if ( mist->apiType == Mist::ApiType::ApiTypeWish ) {
        //printf("mist_addon_start(setupWishApi, %s, core: %s:%d)\n", opts->name, opts->ip, opts->port);
        opts->mist_app = NULL;
        opts->app = app_init();
        
        if(opts->app == NULL) {
            printf("Failed app_init in mist_addon_start.\n");
            exit(EXIT_FAILURE);
            return;
        }
        
        iret = pthread_create(opts->thread, NULL, setupWishApi, (void*) opts);
    } else {
        printf("mist_addon_start received unrecognized type %i, (expecting 2, 3 or 4)\n", mist->apiType);
        exit(EXIT_FAILURE);
    }
    
    if (iret) {
        fprintf(stderr, "Error - pthread_create() return code: %d\n", iret);
        exit(EXIT_FAILURE);
    }
}
