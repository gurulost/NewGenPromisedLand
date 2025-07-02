import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Badge } from "./badge";
import { Progress } from "./progress";
import { Separator } from "./separator";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { TECHNOLOGIES, getAvailableTechnologies, calculateResearchCost, type Technology } from "@shared/data/technologies";
import { Star, Book, Swords, Church, Map } from "lucide-react";

interface TechPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function TechPanel({ open, onClose }: TechPanelProps) {
  const { gameState, dispatch } = useLocalGame();
  const [selectedCategory, setSelectedCategory] = useState<Technology['category']>('economic');
  
  if (!open || !gameState) return null;
  
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const availableTechs = getAvailableTechnologies(currentPlayer.researchedTechs);
  const researchedCount = currentPlayer.researchedTechs.length;
  
  const categorizedTechs = {
    economic: availableTechs.filter(tech => tech.category === 'economic'),
    military: availableTechs.filter(tech => tech.category === 'military'),
    religious: availableTechs.filter(tech => tech.category === 'religious'),
    exploration: availableTechs.filter(tech => tech.category === 'exploration'),
  };
  
  const handleResearchTech = (techId: string) => {
    try {
      console.log('=== TechPanel: Research button clicked ===');
      console.log('Tech ID:', techId);
      console.log('Current player:', currentPlayer);
      
      const tech = TECHNOLOGIES[techId];
      if (!tech) {
        console.error('Tech not found:', techId);
        return;
      }
      
      const cost = calculateResearchCost(tech, researchedCount);
      console.log('Tech cost:', cost, 'Player stars:', currentPlayer.stars);
      
      if (currentPlayer.stars >= cost) {
        console.log('Dispatching RESEARCH_TECH action');
        dispatch({
          type: 'RESEARCH_TECH',
          payload: {
            playerId: currentPlayer.id,
            techId,
          }
        });
        console.log('Action dispatched successfully');
      } else {
        console.log('Cannot afford tech - need', cost - currentPlayer.stars, 'more stars');
      }
    } catch (error) {
      console.error('Error in handleResearchTech:', error);
    }
  };
  
  const getCategoryIcon = (category: Technology['category']) => {
    switch (category) {
      case 'economic': return <Star className="w-4 h-4" />;
      case 'military': return <Swords className="w-4 h-4" />;
      case 'religious': return <Church className="w-4 h-4" />;
      case 'exploration': return <Map className="w-4 h-4" />;
    }
  };
  
  const getCategoryColor = (category: Technology['category']) => {
    switch (category) {
      case 'economic': return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
      case 'military': return 'bg-red-100 text-red-800 hover:bg-red-200';
      case 'religious': return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'exploration': return 'bg-green-100 text-green-800 hover:bg-green-200';
    }
  };
  
  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <Card className="w-[90%] h-[90%] max-w-4xl bg-white border-2" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="border-b">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Book className="w-5 h-5" />
              Technology Research
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="font-semibold">{currentPlayer.stars} Stars</span>
              </div>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
          
          {/* Current Research Progress */}
          {currentPlayer.currentResearch && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">
                  Researching: {TECHNOLOGIES[currentPlayer.currentResearch]?.name}
                </span>
                <span className="text-sm text-gray-600">
                  {currentPlayer.researchProgress}% complete
                </span>
              </div>
              <Progress value={currentPlayer.researchProgress} className="h-2" />
            </div>
          )}
          
          {/* Category Tabs */}
          <div className="flex gap-2 mt-4">
            {(['economic', 'military', 'religious', 'exploration'] as const).map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className={`flex items-center gap-2 ${selectedCategory === category ? '' : getCategoryColor(category)}`}
              >
                {getCategoryIcon(category)}
                {category.charAt(0).toUpperCase() + category.slice(1)}
                <Badge variant="secondary" className="ml-1">
                  {categorizedTechs[category].length}
                </Badge>
              </Button>
            ))}
          </div>
        </CardHeader>
        
        <CardContent className="p-6 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categorizedTechs[selectedCategory].map(tech => {
              const cost = calculateResearchCost(tech, researchedCount);
              const canAfford = currentPlayer.stars >= cost;
              const isResearching = currentPlayer.currentResearch === tech.id;
              
              return (
                <Card key={tech.id} className="border transition-all hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{tech.name}</CardTitle>
                        <Badge variant="outline" className={getCategoryColor(tech.category)}>
                          {getCategoryIcon(tech.category)}
                          {tech.category}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500" />
                          <span className="font-semibold">{cost}</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <p className="text-sm text-gray-600 mb-3">
                      {tech.description}
                    </p>
                    
                    {/* Prerequisites */}
                    {tech.prerequisites.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-gray-500 mb-1">
                          Prerequisites:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {tech.prerequisites.map(prereqId => (
                            <Badge key={prereqId} variant="secondary" className="text-xs">
                              {TECHNOLOGIES[prereqId]?.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Unlocks */}
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">
                        Unlocks:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {tech.unlocks.units?.map(unit => (
                          <Badge key={unit} variant="outline" className="text-xs">
                            {unit}
                          </Badge>
                        ))}
                        {tech.unlocks.improvements?.map(improvement => (
                          <Badge key={improvement} variant="outline" className="text-xs">
                            {improvement}
                          </Badge>
                        ))}
                        {tech.unlocks.structures?.map(structure => (
                          <Badge key={structure} variant="outline" className="text-xs">
                            {structure}
                          </Badge>
                        ))}
                        {tech.unlocks.abilities?.map(ability => (
                          <Badge key={ability} variant="outline" className="text-xs">
                            {ability}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <Separator className="my-3" />
                    
                    <Button
                      onClick={() => handleResearchTech(tech.id)}
                      disabled={!canAfford || isResearching}
                      className="w-full"
                      variant={canAfford ? "default" : "outline"}
                    >
                      {isResearching ? "Researching..." : 
                       canAfford ? "Research" : 
                       `Need ${cost - currentPlayer.stars} more stars`}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          {categorizedTechs[selectedCategory].length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Book className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No {selectedCategory} technologies available for research.</p>
              <p className="text-sm mt-2">Research prerequisites or check other categories.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}