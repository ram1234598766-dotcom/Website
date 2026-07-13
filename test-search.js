import google from 'googlethis';
async function test() {
  const options = {
    page: 0, 
    safe: false, 
    additional_params: { hl: 'en' }
  }
  const response = await google.search('weather in london', options);
  console.log(response.results.slice(0, 2));
}
test();
