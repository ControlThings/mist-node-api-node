#pragma once
#include "nan.h"
#include "StreamingWorker.h"

class StreamingWorkerWrapper : public Nan::ObjectWrap {
public:

    static void Init(v8::Local<v8::Object> exports);

private:

    explicit StreamingWorkerWrapper(StreamingWorker * worker);

    ~StreamingWorkerWrapper();

    static void New(const Nan::FunctionCallbackInfo<v8::Value>& info);
    
    static void sendToAddon(const Nan::FunctionCallbackInfo<v8::Value>& info);

    static void closeInput(const Nan::FunctionCallbackInfo<v8::Value>& info);

    static inline Nan::Persistent<v8::Function> & constructor();

    StreamingWorker * _worker;
};

