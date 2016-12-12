#include "functions.h"
#include "mist_app.h"
#include "mist_api.h"
#include "wish_core_client.h"
#include "bson_visitor.h"

#include <pthread.h>
#include <stdio.h>

static enum mist_error hw_read_string(mist_ep* ep, void* result) {
    memcpy(result, "nodejs plugins rule!", 21);
    return MIST_NO_ERROR;
}

static void init(wish_app_t* app) {
    WISHDEBUG(LOG_CRITICAL, "API ready!");
}

pthread_mutex_t mutex1 = PTHREAD_MUTEX_INITIALIZER;

static int input_buffer_len = 0;
static char input_buffer[2048];

bool injectMessage(uint8_t *msg, int len) {
    if (pthread_mutex_trylock(&mutex1)) {
        return NULL;
    }

    bool success = false;
    
    // check if we can inject a new message, i.e input buffer is consumed by Mist

    if (input_buffer_len == 0) {
        // last message was consumed, injecting new message
        // by writing new message to input buffer
        printf("Lock acquired, injecting");
        memcpy(input_buffer, msg, len);
        input_buffer_len = len;
        success = true;
    } else {
        // last message has not been consumed
        printf("Lock acquired, but last message was not consumed yet.");
    }

    // release lock   
    pthread_mutex_unlock(&mutex1);
    return success;
}

static void mist_api_periodic_cb_impl(void* ctx) {
    if (pthread_mutex_trylock(&mutex1)) {
        WISHDEBUG(LOG_CRITICAL, "Failed trylock. Fail-safe worked!");
        return;
    }

    // check if we can inject a new message, i.e input buffer is consumed by Mist

    if (input_buffer_len > 0) {
        // last message was consumed, injecting new message
        // by writing new message to input buffer
        printf("Lock acquired, consuming");
        
        //bson_visit( (uint8_t*) input_buffer, elem_visitor);
        
        input_buffer_len = 0;
    } else {
        // last message has not been consumed
        printf("Lock acquired, but no data.");
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
        scaling : 1
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
    
    uv_loop_t loop;
    uv_loop_init(&loop);
    
    wish_core_client_init(app);    
    return NULL;
}

NAN_METHOD(nothing) {
}

NAN_METHOD(aString) {

    pthread_t thread1;
    //pthread_t thread2;
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

    //iret2 = pthread_create(&thread2, NULL, print_message_function, (void*) message2);
    //if (iret2) {
    //    fprintf(stderr, "Error - pthread_create() return code: %d\n", iret2);
    //    exit(EXIT_FAILURE);
    //}

    printf("pthread_create() for thread 1 returns: %d\n", iret1);
    //printf("pthread_create() for thread 2 returns: %d\n", iret2);

    /* Wait till threads are complete before main continues. Unless we  */
    /* wait we run the risk of executing an exit which will terminate   */
    /* the process and all threads before the threads have completed.   */

    //pthread_join(thread1, NULL);
    //pthread_join(thread2, NULL);
        
    info.GetReturnValue().Set(Nan::New("This is a thing.").ToLocalChecked());
}

NAN_METHOD(aBoolean) {
    info.GetReturnValue().Set(false);
}

NAN_METHOD(mistApp) {
    info.GetReturnValue().Set(true);
}

NAN_METHOD(aNumber) {
    info.GetReturnValue().Set(1.75);
}

NAN_METHOD(anObject) {
    v8::Local<v8::Object> obj = Nan::New<v8::Object>();
    Nan::Set(obj, Nan::New("key").ToLocalChecked(), Nan::New("value").ToLocalChecked());
    info.GetReturnValue().Set(obj);
}

NAN_METHOD(anArray) {
    v8::Local<v8::Array> arr = Nan::New<v8::Array>(3);
    Nan::Set(arr, 0, Nan::New(1));
    Nan::Set(arr, 1, Nan::New(2));
    Nan::Set(arr, 2, Nan::New(3));
    info.GetReturnValue().Set(arr);
}

NAN_METHOD(callback) {
    v8::Local<v8::Function> callbackHandle = info[0].As<v8::Function>();
    Nan::MakeCallback(Nan::GetCurrentContext()->Global(), callbackHandle, 0, 0);
}

// Wrapper Impl

Nan::Persistent<v8::Function> MyObject::constructor;

NAN_MODULE_INIT(MyObject::Init) {
    v8::Local<v8::FunctionTemplate> tpl = Nan::New<v8::FunctionTemplate>(New);
    tpl->SetClassName(Nan::New("MyObject").ToLocalChecked());
    tpl->InstanceTemplate()->SetInternalFieldCount(1);

    Nan::SetPrototypeMethod(tpl, "plusOne", PlusOne);

    constructor.Reset(Nan::GetFunction(tpl).ToLocalChecked());
    Nan::Set(target, Nan::New("MyObject").ToLocalChecked(), Nan::GetFunction(tpl).ToLocalChecked());
}

MyObject::MyObject(double value) : value_(value) {
}

MyObject::~MyObject() {
}

NAN_METHOD(MyObject::New) {
    if (info.IsConstructCall()) {
        double value = info[0]->IsUndefined() ? 0 : Nan::To<double>(info[0]).FromJust();
        MyObject *obj = new MyObject(value);
        obj->Wrap(info.This());
        info.GetReturnValue().Set(info.This());
    } else {
        const int argc = 1;
        v8::Local<v8::Value> argv[argc] = {info[0]};
        v8::Local<v8::Function> cons = Nan::New(constructor);
        info.GetReturnValue().Set(cons->NewInstance(argc, argv));
    }
}

NAN_METHOD(MyObject::PlusOne) {
    MyObject* obj = Nan::ObjectWrap::Unwrap<MyObject>(info.This());
    obj->value_ += 1;
    info.GetReturnValue().Set(obj->value_);
}
