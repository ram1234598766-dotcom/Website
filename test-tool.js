async function test() {
  const systemPrompt = "You are the Deep-Thinking Omni-AI for OpenLayer. You have access to real-time information. If the user asks for real-time info (weather, news, facts, astrology, etc), reply EXACTLY with 'TOOL:SEARCH:<query>'. DO NOT answer directly. DO NOT apologize.";
  const msgs = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'What is the weather in Uppal, Hyderabad right now?' }
  ];
  
  const response = await fetch("https://text.pollinations.ai/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: msgs, model: "openai" })
  });
  console.log(await response.text());
}
test();
