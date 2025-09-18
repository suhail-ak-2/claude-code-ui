import json
import time
from typing import List, Dict, Any, Optional, Callable
from dataclasses import dataclass, asdict
from datetime import datetime
import uuid


@dataclass
class Memory:
    id: str
    content: str
    timestamp: datetime
    memory_type: str
    importance: int = 1
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            **asdict(self),
            'timestamp': self.timestamp.isoformat()
        }


@dataclass
class Action:
    name: str
    description: str
    function: Callable
    required_params: List[str]
    
    def execute(self, params: Dict[str, Any]) -> Any:
        missing_params = [p for p in self.required_params if p not in params]
        if missing_params:
            raise ValueError(f"Missing required parameters: {missing_params}")
        return self.function(**params)


class AgenticAI:
    def __init__(self, name: str = "Agent", personality: str = "helpful assistant"):
        self.name = name
        self.personality = personality
        self.memories: List[Memory] = []
        self.actions: Dict[str, Action] = {}
        self.context_window = 10
        self.running = False
        
    def add_memory(self, content: str, memory_type: str = "observation", importance: int = 1):
        memory = Memory(
            id=str(uuid.uuid4()),
            content=content,
            timestamp=datetime.now(),
            memory_type=memory_type,
            importance=importance
        )
        self.memories.append(memory)
        
        # Keep only most recent memories within context window
        if len(self.memories) > self.context_window:
            self.memories = sorted(self.memories, key=lambda m: m.importance, reverse=True)
            self.memories = self.memories[:self.context_window]
    
    def get_recent_memories(self, count: int = 5) -> List[Memory]:
        return sorted(self.memories, key=lambda m: m.timestamp, reverse=True)[:count]
    
    def add_action(self, name: str, description: str, function: Callable, required_params: List[str]):
        action = Action(name, description, function, required_params)
        self.actions[name] = action
    
    def list_actions(self) -> List[str]:
        return list(self.actions.keys())
    
    def execute_action(self, action_name: str, params: Dict[str, Any]) -> Any:
        if action_name not in self.actions:
            raise ValueError(f"Unknown action: {action_name}")
        
        result = self.actions[action_name].execute(params)
        self.add_memory(f"Executed action '{action_name}' with params {params}. Result: {result}", 
                       "action", importance=2)
        return result
    
    def think(self, prompt: str) -> str:
        self.add_memory(f"Received input: {prompt}", "input", importance=3)
        
        # Simple reasoning based on memories and available actions
        recent_memories = self.get_recent_memories()
        memory_context = "\n".join([f"- {m.content}" for m in recent_memories])
        
        available_actions = ", ".join(self.list_actions())
        
        # Simple rule-based response generation
        if "calculate" in prompt.lower() or "math" in prompt.lower():
            if "calculate" in self.actions:
                try:
                    # Extract numbers for calculation
                    words = prompt.split()
                    numbers = [float(w) for w in words if w.replace('.', '').replace('-', '').isdigit()]
                    if len(numbers) >= 2:
                        result = self.execute_action("calculate", {"a": numbers[0], "b": numbers[1], "operation": "add"})
                        response = f"I calculated {numbers[0]} + {numbers[1]} = {result}"
                    else:
                        response = "I need at least two numbers to perform a calculation."
                except:
                    response = "I couldn't parse the numbers for calculation."
            else:
                response = "I don't have calculation capabilities available."
        
        elif "remember" in prompt.lower():
            if recent_memories:
                response = f"Here's what I remember:\n{memory_context}"
            else:
                response = "I don't have any memories to recall yet."
        
        elif "actions" in prompt.lower() or "capabilities" in prompt.lower():
            response = f"I can perform these actions: {available_actions}"
        
        else:
            response = f"I'm {self.name}, a {self.personality}. I heard you say: '{prompt}'. I have {len(recent_memories)} recent memories and can perform these actions: {available_actions}"
        
        self.add_memory(f"Generated response: {response}", "response", importance=2)
        return response
    
    def run_interactive(self):
        print(f"🤖 {self.name} is now running. Type 'quit' to exit.")
        print(f"Available actions: {', '.join(self.list_actions())}")
        
        self.running = True
        while self.running:
            try:
                user_input = input(f"\n👤 You: ").strip()
                
                if user_input.lower() in ['quit', 'exit', 'stop']:
                    self.running = False
                    print(f"🤖 {self.name}: Goodbye!")
                    break
                
                if not user_input:
                    continue
                
                response = self.think(user_input)
                print(f"🤖 {self.name}: {response}")
                
            except KeyboardInterrupt:
                self.running = False
                print(f"\n🤖 {self.name}: Interrupted. Goodbye!")
                break
            except Exception as e:
                print(f"🤖 {self.name}: Error - {str(e)}")


def sample_calculate(a: float, b: float, operation: str = "add") -> float:
    if operation == "add":
        return a + b
    elif operation == "subtract":
        return a - b
    elif operation == "multiply":
        return a * b
    elif operation == "divide":
        return a / b if b != 0 else float('inf')
    else:
        raise ValueError(f"Unknown operation: {operation}")


def sample_greet(name: str = "there") -> str:
    return f"Hello, {name}! Nice to meet you."


def sample_get_time() -> str:
    return f"The current time is {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"


if __name__ == "__main__":
    agent = AgenticAI("Alice", "helpful math and conversation assistant")
    
    agent.add_action("calculate", "Perform basic math operations", sample_calculate, ["a", "b"])
    agent.add_action("greet", "Greet someone by name", sample_greet, [])
    agent.add_action("get_time", "Get the current time", sample_get_time, [])
    
    print("🚀 Agentic AI System Starting...")
    print("="*50)
    
    # Demonstrate some capabilities
    print("📋 Demo Mode:")
    print(f"Agent: {agent.think('Hello there!')}")
    print(f"Agent: {agent.think('What can you do?')}")
    print(f"Agent: {agent.think('Calculate 15 plus 27')}")
    print(f"Agent: {agent.think('What do you remember?')}")
    
    print("\n" + "="*50)
    print("🎮 Interactive Mode:")
    agent.run_interactive()