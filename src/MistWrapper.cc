#include "MistWrapper.h"
#include "functions.h"
#include <iostream>

using namespace std;
using namespace Nan;

Nan::Persistent<v8::Function> MistWrapper::constructor;

MistWrapper::MistWrapper(Mist* mist) {
    _mist = mist;
    mist->setWrapper(this);
    
    //cout << "Streaming worker constructor " << (void*)_mist << " w: " << (void*)_worker << "\n";
}

MistWrapper::~MistWrapper() {
    cout << "Destroying MistWrapper" << "\n";
}

void
MistWrapper::mistDeleted() {
    //cout << "MistWrapper lost the actual Mist instance (Deleted by Nan).\n";
    _mist = NULL;
}

void
MistWrapper::New(const Nan::FunctionCallbackInfo<v8::Value>& info) {
    //info.GetReturnValue().Set(Nan::New("world").ToLocalChecked());

    if (info.IsConstructCall()) {

        Callback *data_callback = new Callback(info[0].As<v8::Function>());
        v8::Local<v8::Object> options = info[1].As<v8::Object>();
        
        Mist* mist = new Mist(data_callback);
        
        if (options->IsObject()) {
            v8::Local<v8::Value> _nodeName = options->Get(Nan::New<v8::String>("name").ToLocalChecked());
            v8::Local<v8::Value> _protocol = options->Get(Nan::New<v8::String>("protocols").ToLocalChecked());
            v8::Local<v8::Value> _coreIp = options->Get(Nan::New<v8::String>("coreIp").ToLocalChecked());
            v8::Local<v8::Value> _corePort = options->Get(Nan::New<v8::String>("corePort").ToLocalChecked());
            v8::Local<v8::Value> _apiType = options->Get(Nan::New<v8::String>("type").ToLocalChecked());

            if (_nodeName->IsString()) {
                mist->name = string(*v8::String::Utf8Value(_nodeName->ToString()));
            }

            if (_protocol->IsString()) {
                mist->protocol = string(*v8::String::Utf8Value(_protocol->ToString()));
                //cout << "MistWrapper: protocol: " << mist->protocol;
            }

            if (_coreIp->IsString()) {
                mist->coreIp = string(*v8::String::Utf8Value(_coreIp->ToString()));
                //cout << "4. a) MistWrapper constructor: opts: " << coreIp << "\n";
            } else {
                //cout << "4. b) MistWrapper constructor: opts.core not string\n";
            }

            if (_corePort->IsNumber()) {
                mist->corePort = (int) _corePort->NumberValue();
            }

            if (_apiType->IsNumber()) {
                mist->apiType = (int) _apiType->NumberValue();
            }
        }

        // Start the C library
        mist_addon_start(mist);

        MistWrapper *mistWrapper = new MistWrapper(mist);
        
        mistWrapper->Wrap(info.This());
        info.GetReturnValue().Set(info.This());

        // start the worker
        AsyncQueueWorker(mistWrapper->_mist);
        //data_callback->Call(0, 0);
        //printf("AsyncQueueWorker started\n");
    }
}

void
MistWrapper::request(const Nan::FunctionCallbackInfo<v8::Value>& info) {
    
    if (info.Length() != 2) {
        Nan::ThrowTypeError("Wrong number of arguments");
        return;
    }

    if (!info[0]->IsString()) {
        Nan::ThrowTypeError("Wrong arguments");
        return;
    }

    if (!info[1]->ToObject()->IsUint8Array()) {
        Nan::ThrowTypeError("Argument 2 is not a Buffer");
        return;
    }
    
    v8::String::Utf8Value name(info[0]->ToString());
    
    uint8_t* buf = (uint8_t*) node::Buffer::Data(info[1]->ToObject());
    int buf_len = node::Buffer::Length(info[1]->ToObject());
    MistWrapper* obj = Nan::ObjectWrap::Unwrap<MistWrapper>(info.Holder());
    
    //printf("request Mist instance %p %p\n", obj->_mist, obj->_worker);
    
    if ( obj->_mist == NULL ) {
        //printf("Someone is trying to make requests while the whole thing is already shut down. Ditched. MistWrapper %p\n", obj);
        return;
    }
    
    obj->_mist->fromNode.write(Message(*name, buf, buf_len));
}

void
MistWrapper::Init(v8::Local<v8::Object> exports) {
    mist_addon_init();
    
    v8::Local<v8::FunctionTemplate> tpl = Nan::New<v8::FunctionTemplate>(MistWrapper::New);
    tpl->SetClassName(Nan::New("MistApi").ToLocalChecked());
    tpl->InstanceTemplate()->SetInternalFieldCount(2);

    SetPrototypeMethod(tpl, "request", request);

    constructor.Reset(tpl->GetFunction());
    
    exports->Set(Nan::New("MistApi").ToLocalChecked(), tpl->GetFunction());
}

NODE_MODULE(MistApi, MistWrapper::Init)
