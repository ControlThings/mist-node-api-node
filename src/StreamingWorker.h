#pragma once

#include "PCQueue.h"
#include "Message.h"
#include "nan.h"


class StreamingWorker : public Nan::AsyncProgressWorker {
public:

    StreamingWorker(Nan::Callback *progress, Nan::Callback *callback, Nan::Callback *error_callback);

    ~StreamingWorker();

    void HandleErrorCallback();

    void HandleOKCallback();

    void HandleProgressCallback(const char *data, size_t size);

    void close();

    PCQueue<Message> fromNode;

    void writeToNode(const Nan::AsyncProgressWorker::ExecutionProgress& progress, Message & msg);


protected:

    bool closed();


    Nan::Callback *progress;
    Nan::Callback *error_callback;
    PCQueue<Message> toNode;
    bool input_closed;

private:

    void drainQueue();
};

