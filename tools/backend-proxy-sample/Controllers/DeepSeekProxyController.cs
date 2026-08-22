using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Bkit.Ai.Proxy.DTOs;

namespace Bkit.Ai.Proxy.Controllers
{
    /// <summary>
    /// Authenticated DeepSeek Flash 4 / V3 / R1 Reverse Proxy Controller.
    /// Injects secret DEEPSEEK_API_KEY on the server side and verifies user JWT token from auth.bkit.vn.
    /// </summary>
    [ApiController]
    [Route("api/ai/chat")]
    [Authorize] // Requires valid JWT token issued by auth.bkit.vn
    public class DeepSeekProxyController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;
        private readonly ILogger<DeepSeekProxyController> _logger;

        public DeepSeekProxyController(
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration,
            ILogger<DeepSeekProxyController> logger)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
            _logger = logger;
        }

        [HttpPost("completions")]
        public async Task StreamCompletions([FromBody] ChatCompletionRequest request, CancellationToken cancellationToken)
        {
            var userId = User.Identity?.Name ?? "anonymous_bkit_user";
            _logger.LogInformation("Processing DeepSeek LLM request for User: {UserId}, Model: {Model}", userId, request.Model);

            // 1. Fetch Backend DeepSeek API Key from secure server environment/secrets
            var apiKey = _configuration["DeepSeek:ApiKey"] 
                         ?? Environment.GetEnvironmentVariable("DEEPSEEK_API_KEY") 
                         ?? _configuration["AI:DeepSeekApiKey"];

            if (string.IsNullOrWhiteSpace(apiKey))
            {
                Response.StatusCode = 500;
                Response.ContentType = "application/json";
                await Response.WriteAsync(JsonSerializer.Serialize(new { error = "Máy chủ chưa cấu hình DEEPSEEK_API_KEY." }), cancellationToken);
                return;
            }

            var deepSeekBaseUrl = _configuration["DeepSeek:BaseUrl"] ?? "https://api.deepseek.com";
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromMinutes(5);

            var forwardRequest = new HttpRequestMessage(HttpMethod.Post, $"{deepSeekBaseUrl.TrimEnd('/')}/v1/chat/completions");
            forwardRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            forwardRequest.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/event-stream"));

            // Enforce stream = true
            request.Stream = true;
            var jsonPayload = JsonSerializer.Serialize(request);
            forwardRequest.Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

            try
            {
                var response = await client.SendAsync(forwardRequest, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync(cancellationToken);
                    _logger.LogError("DeepSeek API error: {StatusCode} - {Content}", response.StatusCode, errorContent);

                    Response.StatusCode = (int)response.StatusCode;
                    Response.ContentType = "application/json";
                    await Response.WriteAsync(errorContent, cancellationToken);
                    return;
                }

                Response.ContentType = "text/event-stream";
                Response.Headers["Cache-Control"] = "no-cache";
                Response.Headers["X-Accel-Buffering"] = "no"; // Disable buffering in Nginx/Caddy proxies

                using var responseStream = await response.Content.ReadAsStreamAsync(cancellationToken);
                using var reader = new StreamReader(responseStream, Encoding.UTF8);

                while (!reader.EndOfStream && !cancellationToken.IsCancellationRequested)
                {
                    var line = await reader.ReadLineAsync();
                    if (line != null)
                    {
                        var data = Encoding.UTF8.GetBytes(line + "\n");
                        await Response.Body.WriteAsync(data, 0, data.Length, cancellationToken);
                        await Response.Body.FlushAsync(cancellationToken);
                    }
                }
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("Chat stream cancelled by client.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while proxying DeepSeek chat stream.");
                if (!Response.HasStarted)
                {
                    Response.StatusCode = 500;
                    Response.ContentType = "application/json";
                    await Response.WriteAsync(JsonSerializer.Serialize(new { error = ex.Message }), cancellationToken);
                }
            }
        }
    }
}
