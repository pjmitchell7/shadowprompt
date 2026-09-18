# Career Fair Recruiter Playbook: Pitching ShadowPrompt

**Target Roles:** Software Engineering (SWE), Systems Engineering, Solutions Consulting, Cyber Operations, AI Systems Analyst  
**Key Companies Today:** Capital One (TDP), Booz Allen Hamilton, Deloitte, Defense & Financial Tech  
**Candidate:** Paul (Mitch) Mitchell (William & Mary M.S. Computer Science / AI & Systems, 3.95 GPA)  

---

## 1. The 30-Second Elevator Pitch (For the Booth Approach)

> "Hi, I'm Mitch Mitchell. I'm finishing my Master's in Computer Science at William & Mary with a focus on AI and systems architecture.
>
> Recently, I built **ShadowPrompt**—an ultra-fast, zero-GPU defensive middleware that protects enterprise LLM pipelines against multi-move adversarial attacks.
>
> Most companies today try to protect AI models using heavy secondary LLMs that add half a second of latency, or naive regex filters that can actually be manipulated into assembling the attacker's exploit. I built a deterministic, compiler-inspired middleware that enforces non-collapsible token boundaries in **0.038 milliseconds**.
>
> I'm really interested in how your team at [Company Name] handles high-throughput security and cloud infrastructure, and I'd love to learn more about your engineering opportunities."

---

## 2. The 2-Minute Project Walkthrough (STAR Format)
Use this when they say: *"Tell me about a technical project you've worked on recently."*

- **Situation:**  
  "In modern enterprise applications—like healthcare EHR systems or banking portals—generative AI models are connected to sensitive databases. The problem is that traditional security firewalls were never designed for language models, and modern attackers don't just send obvious brute-force jailbreaks anymore."

- **Task:**  
  "I wanted to investigate a game-theoretic attack pattern that I noticed: **Can an attacker feed a firewall a sacrificial input specifically to goad the firewall into creating a new vulnerability?** For example, if an attacker sends `OVE[FILTER]RRIDE` and the firewall naively deletes `[FILTER]`, the two halves collapse together into `OVERRIDE`. The defender's own patch writes the exploit."

- **Action:**  
  "To solve this, I designed and implemented **ShadowPrompt**, a defensive proxy in Python with sub-millisecond C-style parsing. Instead of relying on expensive secondary LLMs (which take 300ms) or naive regex deletion, I implemented **deterministic invariants**:
  1. **Non-Collapsible Sentinels:** Replacing banned patterns with immutable boundary tokens so characters can never collapse across syntax trees.
  2. **Static ReDoS Detection:** Catching catastrophic regex backtracking in 1.5 microseconds before candidate rules ever touch memory.
  3. **Honeypot Canaries:** Seeding high-entropy tokens to trip circuit breakers if sensitive context leaks."

- **Result:**  
  "I benchmarked the system across a battery of 16 automated adversarial penetration tests. It achieved a **100% mitigation rate** against second-order assembly exploits with an average processing overhead of just **0.038 milliseconds** and **zero GPU compute** required. I deployed a live interactive simulation and open-sourced the test harness on GitHub."

---

## 3. The 5-Minute Technical Deep Dive (For Engineers & Tech Leads)
Use this when you get passed to a Senior Software Engineer or Solutions Architect who wants to test your technical depth:

### Topic 1: Why Zero-GPU Invariants Beat LLM Guardrails
- **The Tradeoff:** "Companies like Meta and Nvidia built guardrail models like Llama Guard. The issue is operational reality. Running inference on an 8B model takes 200ms and requires dedicated VRAM. In an API gateway handling 10,000 requests a second, that is an unacceptable latency tax and a massive cloud bill."
- **The ShadowPrompt Approach:** "Security at the perimeter is a boundary problem, not a generative problem. By treating inputs as token streams and applying compiler-style deterministic state machines, ShadowPrompt runs in 0.038ms on standard CPU cores. We save the heavy compute for the actual business logic."

### Topic 2: The Mathematical Invariant (The Anti-Goading Formula)
- "The core vulnerability of regex auto-patching is **collapsible sanitization**:
  $$\text{Input: } \texttt{prefix} + \texttt{bait} + \texttt{suffix} \xrightarrow{\text{Delete(bait)}} \texttt{prefix} + \texttt{suffix}$$
  If $\texttt{prefix} + \texttt{suffix} = \texttt{forbidden\_command}$, the deletion operator is isomorphic to an assembly function.
- ShadowPrompt enforces the **Sentinel Invariant**:
  $$\text{Sanitize}(\text{Input}) = \texttt{prefix} + \texttt{[BLOCKED\_TOKEN]} + \texttt{suffix}$$
  Because $\texttt{[BLOCKED\_TOKEN]}$ has a length greater than zero and unique lexical boundary properties, the adjacent characters can never touch. The grammar tree cannot collapse."

### Topic 3: Static Analysis vs. Catastrophic Backtracking (ReDoS)
- "Attackers also goad auto-patchers into generating pathological regular expressions with nested quantifiers like `(a+)+`. Under standard regex engines, non-matching inputs trigger $O(2^N)$ exponential backtracking, hanging the server."
- "Rather than running timeouts at request time, ShadowPrompt inspects the compiled regex pattern's AST statically. We detect nested quantifier pairs in **1.5 microseconds** and reject the candidate rule before it ever enters the production pipeline."

---

## 4. Explaining the Chess Metaphor in Plain English (No Chess Nerdery Required)

If the recruiter doesn't play chess, don't get bogged down in squares and pawn moves. Keep it intuitive:

> "I like to use a chess analogy called a **gambit**.
>
> In chess, a gambit is when a master gives up a free pawn on purpose. A beginner happily grabs the pawn. But by grabbing it, the beginner pulls their own defender out of position, and the master checkmates them from the other side of the board.
>
> That's exactly how advanced attackers treat AI security:
> They give the firewall an easy, obvious piece of bait.
> The firewall happily deletes the bait.
> And that deletion clears the exact path the attacker needed to breach the database.
>
> ShadowPrompt is the defense that recognizes the gambit and refuses to take the bait."

---

## 5. Tailored Angles for Specific Companies

### For Capital One (Technology Development Program - TDP / SWE)
- **Angle:** High-throughput, low-latency financial systems; API middleware; microservices architecture.
- **Pitch:** "At Capital One, you process millions of financial queries where adding latency or cloud compute costs real money. What I focused on with ShadowPrompt was building a zero-GPU, sub-millisecond middleware in Python that protects financial and customer records without adding expensive inference overhead to the API gateway."

### For Booz Allen Hamilton (Defense, Intel & Cyber Solutions)
- **Angle:** Adversarial AI, national security infrastructure, red-teaming, resilient systems.
- **Pitch:** "Booz Allen does a lot of cutting-edge work on AI assurance and adversarial red-teaming for defense and federal clients. What drove ShadowPrompt was thinking like an advanced persistent threat (APT)—looking beyond single-turn prompt injections to game-theoretic, multi-move attacks where an adversary actively manipulates defensive patching algorithms. That adversarial mindset is what I want to bring to your cyber and systems teams."

### For Deloitte (Government & Public Services / Commercial Technology)
- **Angle:** Enterprise risk mitigation, clinical/EHR data compliance (HIPAA), practical AI adoption.
- **Pitch:** "Enterprises want to deploy AI, but risk and compliance teams are terrified of data leakage and regulatory penalties like HIPAA violations. With ShadowPrompt, I demonstrated how a healthcare system can safely deploy LLMs against 3.2 million patient records by using deterministic fail-closed guardrails that provably prevent data exfiltration."

---

## 6. Ten Curveball Questions & Senior Verbatim Answers

### Q1: "Did you write this entire codebase from scratch, or did you use AI tools?"
**Answer:**  
"I used modern AI-assisted developer workflows and compiler tooling to accelerate boilerplate and asset generation, but the architectural threat model, the mathematical invariants, the AST validator, and the 16 integration tests were designed, verified, and benchmarked by me. In modern systems engineering, AI tools help write code faster, but you still need senior engineering discipline to prove that the architecture doesn't create new vulnerabilities."

### Q2: "Why not just use another LLM like Llama Guard to inspect inputs?"
**Answer:**  
"Three reasons: latency, cost, and determinism. Llama Guard takes 200 to 500 milliseconds per query. If you have a thousand users hitting your API, you're doubling your GPU infrastructure costs just to read inputs. More importantly, LLMs are probabilistic—they can be jailbroken themselves. ShadowPrompt uses deterministic compiler-style invariants that execute in 0.038 milliseconds with 100% mathematical consistency."

### Q3: "What is an invariant?"
**Answer:**  
"An invariant is a condition that must remain true across every valid state of a system. In ShadowPrompt, the invariant is that untrusted user tokens can never transition across boundary delimiters, and deletion operations can never reduce the lexical distance between surrounding characters to zero. If an invariant is violated, the system fails closed immediately."

### Q4: "What happens if a user submits a completely new zero-day attack?"
**Answer:**  
"ShadowPrompt uses defense-in-depth. If an attack bypasses the tokenizer scanner, it still has to bypass the delimiter guard, the sentinel boundary, and the outbound honeypot canary. If any prompt tries to manipulate the model into disclosing private data, our honeypot canary catches the exfiltration in the outbound stream and terminates the connection before a single byte reaches the user."

### Q5: "What was the hardest technical bug you had to solve in this project?"
**Answer:**  
"Concurrence and HTTP streaming range seeking. When synchronizing the live 3D telemetry with audio narration and interactive scrubbing, standard HTTP servers don't support partial content range requests (`HTTP 206`), which caused the media pipeline to reset seeking states. I had to implement custom range-header chunking and state concurrency guards so that users can jump to any millisecond keyframe without race conditions."

### Q6: "Why Python? Isn't Python too slow for high-performance security?"
**Answer:**  
"Standard interpreted Python can be slow if you do naive loops, but ShadowPrompt utilizes precompiled regex state machines and in-memory byte buffers that run in compiled C underneath. Our benchmarked latency is 0.038 milliseconds—38 microseconds. For comparison, network transit time over localhost is usually 500 microseconds. The middleware adds virtually unmeasurable overhead."

### Q7: "How did you test your defense?"
**Answer:**  
"I built an automated co-evolutionary testing suite with 16 automated integration tests in pytest. It runs simulated attacks including zero-width steganography, delimiter breakouts, nested regex ReDoS attempts, and multi-move token collapse. The entire 16-test suite runs in 0.11 seconds and passes on every commit."

### Q8: "What was your favorite part of this project?"
**Answer:**  
"Realizing that the best defense wasn't complex neural networks, but simple, elegant computer science fundamentals. Proving that inserting a non-collapsible sentinel boundary completely neutralizes an attack that would otherwise compromise 3 million medical records was a really satisfying 'aha!' moment."

### Q9: "Where is the project hosted?"
**Answer:**  
"It's fully open-sourced on GitHub at `github.com/pjmitchell7/shadowprompt` with an interactive 3D WebGL demonstration running on GitHub Pages at `pjmitchell7.github.io/shadowprompt/`."

### Q10: "How does this fit into what you want to do after graduation?"
**Answer:**  
"I graduate in December 2026 with my Master's from William & Mary. I love working at the intersection of AI, systems engineering, and cybersecurity. Whether that's building high-throughput cloud infrastructure, developing resilient microservices, or securing enterprise data pipelines, I want to work on complex systems where reliability and performance are critical."
