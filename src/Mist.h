#pragma once

#include "nan.h"
#include "StreamingWorker.h"
#include "Message.h"

class Mist : public StreamingWorker {
public:

    Mist(Nan::Callback *data, Nan::Callback *complete, Nan::Callback *error_callback, v8::Local<v8::Object> & options);

    ~Mist();
    
    void sendToNode(Message& message);

    void Execute(const Nan::AsyncProgressWorker::ExecutionProgress& progress);
    
private:
    bool run;
    const Nan::AsyncProgressWorker::ExecutionProgress* _progress;
};
