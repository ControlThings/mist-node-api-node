#include "MistWrapper.h"
#include "functions.h"
#include <iostream>

using namespace std;
using namespace Nan;

Nan::Persistent<v8::Function> MistWrapper::constructor;

MistWrapper::MistWrapper(Mist* mist) {
    _mist = mist;
    _worker = mist;
    //cout << "Streaming worker constructor " << (void*)_mist << " w: " << (void*)_worker << "\n";
}

MistWrapper::~MistWrapper() {}

void
MistWrapper::New(const Nan::FunctionCallbackInfo<v8::Value>& info) {
    //info.GetReturnValue().Set(Nan::New("world").ToLocalChecked());

    if (info.IsConstructCall()) {

        Callback *data_callback = new Callback(info[0].As<v8::Function>());
        v8::Local<v8::Object> options = info[1].As<v8::Object>();

        Mist* mist = new Mist(data_callback);
        
        if (options->IsObject()) {
            v8::Local<v8::Value> _nodeName = options->Get(Nan::New<v8::String>("name").ToLocalChecked());
            v8::Local<v8::Value> _coreIp = options->Get(Nan::New<v8::String>("coreIp").ToLocalChecked());
            v8::Local<v8::Value> _corePort = options->Get(Nan::New<v8::String>("corePort").ToLocalChecked());
            v8::Local<v8::Value> _apiType = options->Get(Nan::New<v8::String>("type").ToLocalChecked());

            if (_nodeName->IsString()) {
                mist->name = string(*v8::String::Utf8Value(_nodeName->ToString()));
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

        if (mist->apiType == 2) {
            // This is a Node Api
            mist_addon_start(mist);
        } else {
            // This is a Mist Api
            mist_addon_start(mist);
        }



        MistWrapper *obj = new MistWrapper(mist);
        
        obj->Wrap(info.This());
        info.GetReturnValue().Set(info.This());

        // start the worker
        AsyncQueueWorker(obj->_worker);
    }
}

void
MistWrapper::sendToAddon(const Nan::FunctionCallbackInfo<v8::Value>& info) {
    
    if (info.Length() != 3) {
        printf("Number of args: %i\n", info.Length());
        Nan::ThrowTypeError("Wrong number of arguments");
        return;
    }

    if (!info[0]->IsString() || !info[1]->IsNumber()) {
        Nan::ThrowTypeError("Wrong arguments");
        return;
    }
    
    v8::String::Utf8Value name(info[0]->ToString());
    v8::String::Utf8Value data(info[1]->ToString());
    
    uint8_t* buf = (uint8_t*) node::Buffer::Data(info[2]->ToObject());
    int buf_len = node::Buffer::Length(info[2]->ToObject());
    MistWrapper* obj = Nan::ObjectWrap::Unwrap<MistWrapper>(info.Holder());
    
    //printf("sendToAddon Mist instance %p %p\n", obj->_mist, obj->_worker);
    
    obj->_worker->fromNode.write(Message(*name, *data, buf, buf_len));
}

void
MistWrapper::Init(v8::Local<v8::Object> exports) {
    v8::Local<v8::FunctionTemplate> tpl = Nan::New<v8::FunctionTemplate>(MistWrapper::New);
    tpl->SetClassName(Nan::New("MistApi").ToLocalChecked());
    tpl->InstanceTemplate()->SetInternalFieldCount(2);

    SetPrototypeMethod(tpl, "sendToAddon", sendToAddon);

    constructor.Reset(tpl->GetFunction());
    
    exports->Set(Nan::New("MistApi").ToLocalChecked(), tpl->GetFunction());
}
