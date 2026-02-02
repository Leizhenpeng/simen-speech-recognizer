{
  "targets": [
    {
      "target_name": "simen_speech_recognizer",
      "sources": [
        "apple_speech.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "NO",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "13.0"
      },
      "conditions": [
        ["OS=='mac'", {
          "libraries": [
            "<(module_root_dir)/AppleSpeech.o"
          ],
          "xcode_settings": {
            "OTHER_LDFLAGS": [
              "-framework", "Speech",
              "-framework", "Foundation",
              "-framework", "AVFoundation"
            ]
          }
        }]
      ]
    }
  ]
}
