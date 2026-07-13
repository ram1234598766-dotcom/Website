const str = "{\"error\":{\"message\":\"{\\n  \\\"error\\\": {\\n    \\\"code\\\": 429,\\n    \\\"message\\\": \\\"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. \\\",\\n    \\\"status\\\": \\\"RESOURCE_EXHAUSTED\\\",\\n    \\\"details\\\": [\\n      {\\n        \\\"@type\\\": \\\"type.googleapis.com/google.rpc.Help\\\",\\n        \\\"links\\\": [\\n          {\\n            \\\"description\\\": \\\"Learn more about Gemini API quotas\\\",\\n            \\\"url\\\": \\\"https://ai.google.dev/gemini-api/docs/rate-limits\\\"\\n          }\\n        ]\\n      }\\n    ]\\n  }\\n}\\n\",\"code\":429,\"status\":\"Too Many Requests\"}}";
let errMsg = str;
try {
  const parsed1 = JSON.parse(errMsg);
  if (parsed1.error && parsed1.error.message) {
    const parsed2 = JSON.parse(parsed1.error.message);
    if (parsed2.error && parsed2.error.message) {
       errMsg = parsed2.error.message;
    } else {
       errMsg = parsed1.error.message;
    }
  }
} catch (e) { console.error(e) }
console.log(errMsg);
