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

static void mist_response_cb(struct wish_rpc_entry* req, void* ctx, const uint8_t* data, size_t data_len) {
    
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

static void wish_response_cb(struct wish_rpc_entry* req, void* ctx, const uint8_t* data, size_t data_len) {
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

static void sandboxed_response_cb(struct wish_rpc_entry* req, void* ctx, const uint8_t* data, size_t data_len) {
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

static enum mist_error hw_read(mist_ep* ep, mist_buf* result) {
    if (ep->data.base == NULL) { return MIST_ERROR; }

    result->base = ep->data.base;
    result->len = ep->data.len;

    return MIST_NO_ERROR;
}

static enum mist_error hw_write(mist_ep* ep, mist_buf data) {
    Mist* mist = NULL;
    struct wish_app_core_opt* opts;
    
    LL_FOREACH(wish_app_core_opts, opts) {
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
        double v = *((double*) data.base);
        double *t = (double*) ep->data.base;
        *t = v;
        bson_append_double(&bs, "data", v);
    } else if (ep->type == MIST_TYPE_INT) {
        int v = *((int*) data.base);
        int *t = (int*) ep->data.base;
        *t = v;
        bson_append_int(&bs, "data", v);
    } else if (ep->type == MIST_TYPE_BOOL) {
        bool v = *((bool*) data.base);
        bool *t = (bool*) ep->data.base;
        *t = v;
        bson_append_bool(&bs, "data", v);
    } else if (ep->type == MIST_TYPE_STRING) {
        if (ep->data.base != NULL) { free(ep->data.base); }
        ep->data.base = (char*) malloc(data.len);
        memcpy(ep->data.base, data.base, data.len);
        ep->data.len = data.len;
        bson_append_string(&bs, "data", ep->data.base);
    } else {
        printf("Unsupported MIST_TYPE %i\n", ep->type);
    }
    
    bson_finish(&bs);

    Message msg("write", (uint8_t*) bson_data(&bs), bson_size(&bs));
    
    mist->sendToNode(msg);
    
    return MIST_NO_ERROR;
}

static enum mist_error hw_invoke(mist_ep* ep, mist_buf args) {
    //printf("in hw_invoke %p\n", ep->model->mist_app);
    
    struct wish_app_core_opt* opts;
    Mist* mist = NULL;
    
    LL_FOREACH(wish_app_core_opts, opts) {
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
    bson_init_with_data(&bs, args.base);
    
    Message msg("invoke", (uint8_t*) bson_data(&bs), bson_size(&bs));
    
    mist->sendToNode(msg);
    
    return MIST_NO_ERROR;
}

static void online(app_t* app, wish_protocol_peer_t* peer) {
    Mist* mist = NULL;
    struct wish_app_core_opt* opts;
    
    LL_FOREACH(wish_app_core_opts, opts) {
        if(opts->app == app) {
            mist = opts->mist;
            //printf("online: %s\n", opts->wish_app->name);
            break;
        }
    }
    
    if (mist == NULL) {
        printf("Failed finding mist instance to call write... bailing out!\n");
        return;
    }
    
    bson bs;
    bson_init(&bs);
    bson_append_start_object(&bs, "peer");
    bson_append_binary(&bs, "luid", (char*) peer->luid, WISH_ID_LEN);
    bson_append_binary(&bs, "ruid", (char*) peer->ruid, WISH_ID_LEN);
    bson_append_binary(&bs, "rhid", (char*) peer->rhid, WISH_WHID_LEN);
    bson_append_binary(&bs, "rsid", (char*) peer->rsid, WISH_WSID_LEN);
    bson_append_string(&bs, "protocol", peer->protocol);
    bson_append_finish_object(&bs);
    bson_finish(&bs);
    
    if (bs.err) { printf("Error producing bson!! %d\n", bs.err); }

    Message msg("online", (uint8_t*) bson_data(&bs), bson_size(&bs));
    
    //printf("online to Mist: %s\n", mist->name.c_str());
    mist->sendToNode(msg);
}

static void offline(app_t* app, wish_protocol_peer_t* peer) {
    Mist* mist = NULL;
    struct wish_app_core_opt* opts;
    
    LL_FOREACH(wish_app_core_opts, opts) {
        if(opts->app == app) {
            mist = opts->mist;
            //printf("    found Mist* %p\n", mist);
            //printf("offline: %s\n", opts->wish_app->name);
            break;
        }
    }
    
    if (mist == NULL) {
        printf("Failed finding mist instance to call write... bailing out!\n");
        return;
    }
    
    bson bs;
    bson_init(&bs);
    bson_append_start_object(&bs, "peer");
    bson_append_binary(&bs, "luid", (char*) peer->luid, WISH_ID_LEN);
    bson_append_binary(&bs, "ruid", (char*) peer->ruid, WISH_ID_LEN);
    bson_append_binary(&bs, "rhid", (char*) peer->rhid, WISH_WHID_LEN);
    bson_append_binary(&bs, "rsid", (char*) peer->rsid, WISH_WSID_LEN);
    bson_append_string(&bs, "protocol", peer->protocol);
    bson_append_finish_object(&bs);
    bson_finish(&bs);

    Message msg("offline", (uint8_t*) bson_data(&bs), bson_size(&bs));

    //printf("offline to Mist: %s\n", mist->name.c_str());
    mist->sendToNode(msg);
}

static void mist_online(mist_app_t* mist_app, wish_protocol_peer_t* peer) {
    WISHDEBUG(LOG_CRITICAL, "mist_online %s %p", mist_app->name, peer);
    
    Mist* mist = NULL;
    struct wish_app_core_opt* opts;
    
    LL_FOREACH(wish_app_core_opts, opts) {
        if(opts->mist_app == mist_app) {
            mist = opts->mist;
            //printf("online: %s\n", opts->wish_app->name);
            break;
        }
    }
    
    if (mist == NULL) {
        printf("Failed finding mist instance to call write... bailing out!\n");
        return;
    }
    
    bson bs;
    bson_init(&bs);
    bson_append_start_object(&bs, "peer");
    bson_append_binary(&bs, "luid", (char*) peer->luid, WISH_ID_LEN);
    bson_append_binary(&bs, "ruid", (char*) peer->ruid, WISH_ID_LEN);
    bson_append_binary(&bs, "rhid", (char*) peer->rhid, WISH_WHID_LEN);
    bson_append_binary(&bs, "rsid", (char*) peer->rsid, WISH_WSID_LEN);
    bson_append_string(&bs, "protocol", peer->protocol);
    bson_append_finish_object(&bs);
    bson_finish(&bs);
    
    if (bs.err) { printf("Error producing bson!! %d\n", bs.err); }

    Message msg("online", (uint8_t*) bson_data(&bs), bson_size(&bs));
    
    //printf("online to Mist: %s\n", mist->name.c_str());
    mist->sendToNode(msg);
}

static void mist_offline(mist_app_t* mist_app, wish_protocol_peer_t* peer) {
    WISHDEBUG(LOG_CRITICAL, "mist_offline %s %p", mist_app->name, peer);

    Mist* mist = NULL;
    struct wish_app_core_opt* opts;
    
    LL_FOREACH(wish_app_core_opts, opts) {
        if(opts->mist_app == mist_app) {
            mist = opts->mist;
            //printf("    found Mist* %p\n", mist);
            //printf("offline: %s\n", opts->wish_app->name);
            break;
        }
    }
    
    if (mist == NULL) {
        printf("Failed finding mist instance to call write... bailing out!\n");
        return;
    }
    
    bson bs;
    bson_init(&bs);
    bson_append_start_object(&bs, "peer");
    bson_append_binary(&bs, "luid", (char*) peer->luid, WISH_ID_LEN);
    bson_append_binary(&bs, "ruid", (char*) peer->ruid, WISH_ID_LEN);
    bson_append_binary(&bs, "rhid", (char*) peer->rhid, WISH_WHID_LEN);
    bson_append_binary(&bs, "rsid", (char*) peer->rsid, WISH_WSID_LEN);
    bson_append_string(&bs, "protocol", peer->protocol);
    bson_append_finish_object(&bs);
    bson_finish(&bs);

    Message msg("offline", (uint8_t*) bson_data(&bs), bson_size(&bs));

    //printf("offline to Mist: %s\n", mist->name.c_str());
    mist->sendToNode(msg);
}

static void frame(app_t* app, const uint8_t* payload, size_t payload_len, wish_protocol_peer_t* peer) {
    Mist* mist = NULL;
    struct wish_app_core_opt* opts;
    
    LL_FOREACH(wish_app_core_opts, opts) {
        if(opts->app == app) {
            mist = opts->mist;
            //printf("    found Mist* %p\n", mist);
            break;
        }
    }
    
    if (mist == NULL) {
        printf("Failed finding mist instance to call write... bailing out!\n");
        return;
    }
    
    bson bs;
    bson_init(&bs);
    bson_append_binary(&bs, "frame", (char*) payload, payload_len);
    bson_append_start_object(&bs, "peer");
    bson_append_binary(&bs, "luid", (char*) peer->luid, WISH_ID_LEN);
    bson_append_binary(&bs, "ruid", (char*) peer->ruid, WISH_ID_LEN);
    bson_append_binary(&bs, "rhid", (char*) peer->rhid, WISH_WHID_LEN);
    bson_append_binary(&bs, "rsid", (char*) peer->rsid, WISH_WSID_LEN);
    bson_append_string(&bs, "protocol", peer->protocol);
    bson_append_finish_object(&bs);
    bson_finish(&bs);

    if (bs.err) { printf("Error producing bson!! %d\n", bs.err); }
    
    Message msg("frame", (uint8_t*) bson_data(&bs), bson_size(&bs));
    
    //printf("frame to Mist: %s\n", mist->name.c_str());
    mist->sendToNode(msg);
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
                    printf("wish_cancel %i\n", bson_iterator_int(&it));
                    wish_core_request_cancel(opts->wish_app, bson_iterator_int(&it));
                    goto consume_and_unlock;
                }

                wish_core_request_context(opts->wish_app, &bs, wish_response_cb, opts->mist);
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
        ep->data.base = (char*) malloc(8);
        ep->data.len = 8;
        if (ep->data.base == NULL) { free(ep); return BSON_VCMD_TERMINATE; }
        memset(ep->data.base, 0, 8);

        ep->id = strdup(key);
        ep->label = strdup(ep_label);
        
        if ( strncmp(ep_type, "float", 16) == 0 ) {
            //printf("A float.\n");
            ep->type = MIST_TYPE_FLOAT;
            *((double*) ep->data.base) = 0.0;
        } else if ( strncmp(ep_type, "int", 16) == 0 ) {
            //printf("An int.\n");
            ep->type = MIST_TYPE_INT;
            *((int*) ep->data.base) = 0;
        } else if ( strncmp(ep_type, "bool", 16) == 0 ) {
            //printf("A bool.\n");
            ep->type = MIST_TYPE_BOOL;
            *((bool*) ep->data.base) = false;
        } else if ( strncmp(ep_type, "string", 16) == 0 ) {
            ep->type = MIST_TYPE_STRING;
            ep->data.base = NULL;
            ep->data.len = 0;
        } else if (invokable) {
            ep->type = MIST_TYPE_INVOKE;                            
        } else {
             return BSON_VCMD_OK;
        }

        if (readable) { ep->read = hw_read; }
        if (writable) { ep->write = hw_write; }
        if (invokable) { ep->invoke = hw_invoke; } //hw_invoke_function;
        ep->unit = NULL;
        ep->next = NULL;
        ep->prev = NULL;
        ep->dirty = false;
        ep->scaling = ep_scale;

        char* parent = endpoint_path_from_model(tpath+6);
        
        mist_add_ep(model, parent, ep);
        
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

static void mist_node_api_handler(mist_app_t* mist_app, input_buf* msg) {
    mist_model* model = &mist_app->model;

    bson bs;
    bson_init_with_data(&bs, msg->data);
    
    bson_visit("mist_node_api_handler:", (const uint8_t*)msg->data);
    
    bson_iterator it;
    bson_find_from_buffer(&it, msg->data, "model");

    if(bson_iterator_type(&it) != BSON_EOO) {
        mist_model_parse(&bs, model);
    } else {

        bson_find_from_buffer(&it, msg->data, "invoke");

        if (bson_iterator_type(&it) == BSON_INT) {
            // this is a response to an invoke request

            /*
             { invoke: request_id,
               data: response_data } 
            */

            int id = bson_iterator_int(&it);

            mist_invoke_response(mist_app->server, id, (uint8_t*) msg->data);
            return;
        }

        bson_find_from_buffer(&it, msg->data, "op");

        if (bson_iterator_type(&it) == BSON_STRING) {
            WISHDEBUG(LOG_CRITICAL, "MistNode request");
            //int id = bson_iterator_int(&it);
            
            //mist_invoke_response(mist_app->server, id, (uint8_t*) msg->data);
            return;
        }


        bson_find_from_buffer(&it, msg->data, "update");
        mist_ep* ep = NULL;
        char* ep_name = (char*) "";

        if ( bson_iterator_type(&it) != BSON_STRING ) {
            return;
        }

        ep_name = (char*) bson_iterator_string(&it);
        mist_find_endpoint_by_name(model, ep_name, &ep);
        if (ep == NULL) {
            WISHDEBUG(LOG_CRITICAL, "update could not find endpoint %s", ep_name);
            return;
        }

        bson_find_from_buffer(&it, msg->data, "value");

        if (ep->type == MIST_TYPE_BOOL) {
            if ( bson_iterator_type(&it) == BSON_BOOL ) {
                *((bool*)ep->data.base) = bson_iterator_bool(&it);
                mist_value_changed(model, ep_name);
            }
        } else if (ep->type == MIST_TYPE_STRING) {
            if ( bson_iterator_type(&it) == BSON_STRING ) {
                if (ep->data.base != NULL) { free(ep->data.base); ep->data.len = 0; }
                ep->data.base = (char*) malloc(bson_iterator_string_len(&it));
                ep->data.len = bson_iterator_string_len(&it);
                memcpy(ep->data.base, bson_iterator_string(&it), bson_iterator_string_len(&it));
                mist_value_changed(model, ep_name);
            }
        } else if (ep->type == MIST_TYPE_INT) {
            if (ep->data.base == NULL) { return; }

            if ( bson_iterator_type(&it) == BSON_DOUBLE ) {
                *((int*)ep->data.base) = (int) bson_iterator_double(&it);
                mist_value_changed(model, ep_name);
            } else if ( bson_iterator_type(&it) == BSON_INT ) {
                *((int*)ep->data.base) = bson_iterator_int(&it);
                mist_value_changed(model, ep_name);
            }
        } else if (ep->type == MIST_TYPE_FLOAT) {
            if (ep->data.base == NULL) { return; }

            if ( bson_iterator_type(&it) == BSON_DOUBLE ) {
                *((double*)ep->data.base) = bson_iterator_double(&it);
                mist_value_changed(model, ep_name);
            } else if ( bson_iterator_type(&it) == BSON_INT ) {
                *((double*)ep->data.base) = (double) bson_iterator_int(&it);
                mist_value_changed(model, ep_name);
            }
        }
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
        return;
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
                //printf("Making wish_api_request\n");
                //bson_visit("Making wish_api_request bson data:", (uint8_t*)bson_data(&bs));
                
                bson_iterator it;
                bson_find(&it, &bs, "cancel");

                if (bson_iterator_type(&it) == BSON_INT) {
                    //printf("wish_cancel %i\n", bson_iterator_int(&it));
                    wish_api_request_cancel(mist_api, bson_iterator_int(&it));
                    goto consume_and_unlock;
                }
                
                wish_api_request_context(mist_api, &bs, wish_response_cb, opts->mist);
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
                //printf("### Wish Api requests are disabled in MistNodeApi\n");
                //wish_api_request(mist_app->app, &bs, mist_response_cb);
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
        free(msg);
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
    
    mist_set_name(mist_app, name);
    
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
    
    mist_set_name(mist_app, name);

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
    pthread_t* thread = (pthread_t*) wish_platform_malloc(sizeof(pthread_t));
    memset(thread, 0, sizeof(pthread_t));

    if ( mist->apiType == Mist::ApiType::ApiTypeMist ) {
        //printf("mist_addon_start(setupMistApi, %s, core: %s:%d)\n", opts->name, opts->ip, opts->port);
        opts->mist_app = start_mist_app();
        opts->app = NULL;
        iret = pthread_create(thread, NULL, setupMistApi, (void*) opts);
    } else if ( mist->apiType == Mist::ApiType::ApiTypeMistNode ) {
        //printf("mist_addon_start(setupMistNodeApi, %s, core: %s:%d)\n", opts->name, opts->ip, opts->port);
        opts->mist_app = start_mist_app();
        opts->app = NULL;
        iret = pthread_create(thread, NULL, setupMistNodeApi, (void*) opts);
    } else if ( mist->apiType == Mist::ApiType::ApiTypeWish ) {
        //printf("mist_addon_start(setupWishApi, %s, core: %s:%d)\n", opts->name, opts->ip, opts->port);
        opts->mist_app = NULL;
        opts->app = app_init();
        
        if(opts->app == NULL) {
            printf("Failed app_init in mist_addon_start.\n");
            exit(EXIT_FAILURE);
            return;
        }
        
        iret = pthread_create(thread, NULL, setupWishApi, (void*) opts);
    } else {
        printf("mist_addon_start received unrecognized type %i, (expecting 2, 3 or 4)\n", mist->apiType);
        exit(EXIT_FAILURE);
    }
    
    if (iret) {
        fprintf(stderr, "Error - pthread_create() return code: %d\n", iret);
        exit(EXIT_FAILURE);
    }
}
