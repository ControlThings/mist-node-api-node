#include "functions.h"
#include "mist_app.h"
#include "mist_api.h"
#include "wish_core_client.h"

NAN_METHOD(nothing) {
}

NAN_METHOD(aString) {
    info.GetReturnValue().Set(Nan::New("This is a thing.").ToLocalChecked());
}

NAN_METHOD(aBoolean) {
    info.GetReturnValue().Set(false);
}

mist_app_t* mist_app;

static enum mist_error hw_read_string(mist_ep* ep, void* result) {
    memcpy(result, "Morjens", 8);
    return MIST_NO_ERROR;
}

static void init(wish_app_t* app) {
    WISHDEBUG(LOG_CRITICAL, "API ready!");
}

NAN_METHOD(mistApp) {
    wish_app_t *app;
    //mist_app_t *mist_app;
    mist_api_t *mist_api;
    
    // name used for WishApp and MistNode name
    const char *name = "MistApi";

    //start wish apps
    mist_app = start_mist_app();

    struct mist_model *model = &(mist_app->model);
    
    /*
    char* id;       // ID of the item (=the name of the document)
    char* label;    // Clear text label
    enum mist_type type;
    char* unit;
    char* data;     // Initial value encoded
    bool readable;
    bool writable;
    bool invokable;
    enum mist_error (*read)(struct mist_endpoint* ep, void* result);
    enum mist_error (*write)(struct mist_endpoint* ep, void* value);
    enum mist_error (*invoke)(struct mist_endpoint* ep, mist_buf args, mist_buf response);
    struct mist_endpoint * next;
    struct mist_endpoint * prev;
    bool dirty;
    // Used in float type 
    uint8_t scaling;    
    */
    
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

    mist_api_t* api = mist_api_init(mist_app);
    
    app->ready = init;
    
    if (app == NULL) {
        printf("Failed creating wish app");
        return;
    }
    
    uv_loop_t loop;
    uv_loop_init(&loop);
    
    wish_core_client_init(app);
    
    info.GetReturnValue().Set(mist_app == NULL ? false : true);
    //info.GetReturnValue().Set(true);
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
