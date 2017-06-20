#pragma once

#include "nan.h"
#include "Mist.h"

class MistWrapper : public Nan::ObjectWrap {
public:

    static void Init(v8::Local<v8::Object> exports);
    
    void mistDeleted();

private:

    explicit MistWrapper(Mist* mist);

    ~MistWrapper();

    static void New(const Nan::FunctionCallbackInfo<v8::Value>& info);
    
    static void request(const Nan::FunctionCallbackInfo<v8::Value>& info);
    
    static Nan::Persistent<v8::Function> constructor;

    Mist* _mist;
};

