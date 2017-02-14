#include "StreamingWorkerWrapper.h"
#include "functions.h"
#include <iostream>

using namespace std;
using namespace Nan;

Nan::Persistent<v8::Function> StreamingWorkerWrapper::constructor;

StreamingWorkerWrapper::StreamingWorkerWrapper(Mist* mist) {
    _mist = mist;
    _worker = mist;
    //cout << "Streaming worker constructor " << (void*)_mist << " w: " << (void*)_worker << "\n";
}

StreamingWorkerWrapper::~StreamingWorkerWrapper() {
}

void
StreamingWorkerWrapper::New(const Nan::FunctionCallbackInfo<v8::Value>& info) {
    //info.GetReturnValue().Set(Nan::New("world").ToLocalChecked());

    if (info.IsConstructCall()) {

        //cout << "3. StreamingWorkerWrapper construct call\n";
        Callback *data_callback = new Callback(info[0].As<v8::Function>());
        Callback *complete_callback = new Callback(info[1].As<v8::Function>());
        Callback *error_callback = new Callback(info[2].As<v8::Function>());
        v8::Local<v8::Object> options = info[3].As<v8::Object>();

        string nodeName = "Node";
        string coreIp = "127.0.0.1";
        uint16_t corePort = 9094;
        uint16_t apiType = 2;

        if (options->IsObject()) {
            v8::Local<v8::Value> _nodeName = options->Get(Nan::New<v8::String>("name").ToLocalChecked());
            v8::Local<v8::Value> _coreIp = options->Get(Nan::New<v8::String>("coreIp").ToLocalChecked());
            v8::Local<v8::Value> _corePort = options->Get(Nan::New<v8::String>("corePort").ToLocalChecked());
            v8::Local<v8::Value> _apiType = options->Get(Nan::New<v8::String>("type").ToLocalChecked());

            if (_nodeName->IsString()) {
                nodeName = string(*v8::String::Utf8Value(_nodeName->ToString()));
            }

            if (_coreIp->IsString()) {
                coreIp = string(*v8::String::Utf8Value(_coreIp->ToString()));
                //cout << "4. a) StreamingWorkerWrapper constructor: opts: " << coreIp << "\n";
            } else {
                //cout << "4. b) StreamingWorkerWrapper constructor: opts.core not string\n";
            }

            if (_corePort->IsNumber()) {
                corePort = (uint16_t) _corePort->NumberValue();
            }

            if (_apiType->IsNumber()) {
                apiType = (uint16_t) _apiType->NumberValue();
            }
        }

        char* ip = strdup(coreIp.c_str());
        char* name = strdup(nodeName.c_str());

        //cout << "Going to call mist_addon_start\n";
        
        Mist* mist = new Mist(data_callback, complete_callback, error_callback, options);
        
        //printf("Mist instance %p\n", mist);

        if (apiType == 2) {
            // This is a Node Api
            mist_addon_start(mist, name, apiType, ip, corePort);
        } else {
            // This is a Mist Api
            mist_addon_start(mist, name, apiType, ip, corePort);
        }



        StreamingWorkerWrapper *obj = new StreamingWorkerWrapper(mist);
        
        obj->Wrap(info.This());
        info.GetReturnValue().Set(info.This());

        // start the worker
        AsyncQueueWorker(obj->_worker);
    }
}

void
StreamingWorkerWrapper::sendToAddon(const Nan::FunctionCallbackInfo<v8::Value>& info) {
    
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
    StreamingWorkerWrapper* obj = Nan::ObjectWrap::Unwrap<StreamingWorkerWrapper>(info.Holder());
    
    //printf("sendToAddon Mist instance %p %p\n", obj->_mist, obj->_worker);
    
    obj->_worker->fromNode.write(Message(*name, *data, buf, buf_len));
}

void
StreamingWorkerWrapper::Init(v8::Local<v8::Object> exports) {
    v8::Local<v8::FunctionTemplate> tpl = Nan::New<v8::FunctionTemplate>(StreamingWorkerWrapper::New);
    tpl->SetClassName(Nan::New("StreamingWorker").ToLocalChecked());
    tpl->InstanceTemplate()->SetInternalFieldCount(2);

    SetPrototypeMethod(tpl, "sendToAddon", sendToAddon);

    constructor.Reset(tpl->GetFunction());
    
    exports->Set(Nan::New("StreamingWorker").ToLocalChecked(), tpl->GetFunction());
}
