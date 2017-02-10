#pragma once
#include "nan.h"
#include "StreamingWorker.h"
#include "Mist.h"

class StreamingWorkerWrapper : public Nan::ObjectWrap {
public:

    static void Init(v8::Local<v8::Object> exports);

private:

    explicit StreamingWorkerWrapper(Mist* mist);

    ~StreamingWorkerWrapper();

    static void New(const Nan::FunctionCallbackInfo<v8::Value>& info);
    
    static void sendToAddon(const Nan::FunctionCallbackInfo<v8::Value>& info);
    
    static void printWrapped(const Nan::FunctionCallbackInfo<v8::Value>& info);

    static void closeInput(const Nan::FunctionCallbackInfo<v8::Value>& info);

    static Nan::Persistent<v8::Function> constructor;

    StreamingWorker * _worker;
    
    Mist* _mist;
};

