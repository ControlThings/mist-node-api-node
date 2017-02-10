#include "StreamingWorkerWrapper.h"
#include "functions.h"
#include <iostream>

using namespace std;
using namespace Nan;

StreamingWorkerWrapper::StreamingWorkerWrapper(StreamingWorker * worker) : _worker(worker) {
}

StreamingWorkerWrapper::~StreamingWorkerWrapper() {
}

StreamingWorker * create_worker(Callback *, Callback *, Callback *, v8::Local<v8::Object> &);

void
StreamingWorkerWrapper::New(const Nan::FunctionCallbackInfo<v8::Value>& info) {
    //info.GetReturnValue().Set(Nan::New("world").ToLocalChecked());

    if (info.IsConstructCall()) {

        cout << "3. StreamingWorkerWrapper construct call\n";
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

        cout << "Going to call mist_addon_start\n";

        if (apiType == 2) {
            // This is a Node Api
            mist_addon_start(name, apiType, ip, corePort);
        } else {
            // This is a Mist Api
            mist_addon_start(name, apiType, ip, corePort);
        }



        StreamingWorkerWrapper *obj = new StreamingWorkerWrapper(create_worker(data_callback, complete_callback, error_callback, options));

        obj->Wrap(info.This());
        info.GetReturnValue().Set(info.This());

        // start the worker
        AsyncQueueWorker(obj->_worker);

    } else {
        cout << "StreamingWorkerWrapper another call\n";
        const int argc = 3;
        v8::Local<v8::Value> argv[argc] = {info[0], info[1], info[2]};
        v8::Local<v8::Function> cons = Nan::New(constructor());
        info.GetReturnValue().Set(cons->NewInstance(argc, argv));
    }
}

void
StreamingWorkerWrapper::sendToAddon(const Nan::FunctionCallbackInfo<v8::Value>& info) {
    v8::String::Utf8Value name(info[0]->ToString());
    v8::String::Utf8Value data(info[1]->ToString());
    uint8_t* buf = (uint8_t*) node::Buffer::Data(info[2]->ToObject());
    int buf_len = node::Buffer::Length(info[2]->ToObject());
    StreamingWorkerWrapper* obj = Nan::ObjectWrap::Unwrap<StreamingWorkerWrapper>(info.Holder());
    obj->_worker->fromNode.write(Message(*name, *data, buf, buf_len));
}

void
StreamingWorkerWrapper::closeInput(const Nan::FunctionCallbackInfo<v8::Value>& info) {
    StreamingWorkerWrapper* obj = Nan::ObjectWrap::Unwrap<StreamingWorkerWrapper>(info.Holder());
    obj->_worker->close();
}

Nan::Persistent<v8::Function> &
StreamingWorkerWrapper::constructor() {
    static Nan::Persistent<v8::Function> my_constructor;
    return my_constructor;
}

void Add(const Nan::FunctionCallbackInfo<v8::Value>& info) {

  if (info.Length() < 2) {
    Nan::ThrowTypeError("Wrong number of arguments");
    return;
  }

  if (!info[0]->IsNumber() || !info[1]->IsNumber()) {
    Nan::ThrowTypeError("Wrong arguments");
    return;
  }

  double arg0 = info[0]->NumberValue();
  double arg1 = info[1]->NumberValue();
  v8::Local<v8::Number> num = Nan::New(arg0 + arg1);

  info.GetReturnValue().Set(num);
}

void
StreamingWorkerWrapper::Init(v8::Local<v8::Object> exports) {
    cout << "1. class StreamingWorkerWrapper::Init {\n";
    v8::Local<v8::FunctionTemplate> tpl = Nan::New<v8::FunctionTemplate>(StreamingWorkerWrapper::New);
    tpl->SetClassName(Nan::New("StreamingWorker").ToLocalChecked());
    tpl->InstanceTemplate()->SetInternalFieldCount(2);

    SetPrototypeMethod(tpl, "sendToAddon", sendToAddon);
    SetPrototypeMethod(tpl, "closeInput", closeInput);

    constructor().Reset(Nan::GetFunction(tpl).ToLocalChecked());
    
    //Nan::Set(target, Nan::New("StreamingWorker").ToLocalChecked(), Nan::GetFunction(tpl).ToLocalChecked());

    exports->Set(Nan::New("hello").ToLocalChecked(), Nan::New<v8::FunctionTemplate>(Add)->GetFunction());
    exports->Set(Nan::New("tpl").ToLocalChecked(), Nan::GetFunction(tpl).ToLocalChecked());
}