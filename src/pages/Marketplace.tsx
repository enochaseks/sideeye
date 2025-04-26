import React, { useState } from 'react';
import { Container, Typography, Box, Grid, TextField, IconButton, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';

// Define categories
const categories = ['All', 'Groceries', 'Hair & Beauty', 'Games', 'Technology', 'Home', 'Clothing', 'Other'];

// Define sort options and create a type for its keys
const sortOptions = {
  'newest': 'Newest First',
  'price_asc': 'Price: Low to High',
  'price_desc': 'Price: High to Low',
} as const; // Use 'as const' for stricter typing of keys

type SortKey = keyof typeof sortOptions; // Define the type for valid sort keys

const Marketplace: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  // Explicitly type the sortBy state using SortKey
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  // TODO: Add state for fetched products, e.g., const [products, setProducts] = useState([]);

  const handleAddProduct = () => {
    // Navigate to a dedicated page/route for adding products
    // This route needs to be created in App.tsx and the corresponding component built
    navigate('/marketplace/add');
  };

  // TODO: Implement functions for fetching, filtering, and sorting products
  // based on searchTerm, selectedCategory, and sortBy state.
  // Example: Fetch products when component mounts or state changes
  // useEffect(() => { /* fetch logic here */ }, [selectedCategory, sortBy]);

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        {/* Header with Title and Add Button */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Marketplace
          </Typography>
          <IconButton
            color="primary"
            aria-label="add product"
            onClick={handleAddProduct}
            sx={{ border: '1px solid', borderColor: 'primary.main', '&:hover': { backgroundColor: 'primary.lighter' } }} // Added hover effect
          >
            <AddIcon />
          </IconButton>
        </Box>

        {/* Controls Row: Search, Category, Sort */}
        <Grid container spacing={2} sx={{ mb: 4 }} alignItems="flex-end"> {/* Changed alignItems */} 
          <Grid item xs={12} sm={6} md={5}> {/* Adjusted grid size */}
            <TextField
              fullWidth
              label="Search Products"
              variant="outlined"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small" // Made TextField smaller
            />
          </Grid>
          <Grid item xs={6} sm={3} md={3}> {/* Adjusted grid size */}
            <FormControl fullWidth variant="outlined" size="small"> {/* Made FormControl smaller */}
              <InputLabel id="category-select-label">Category</InputLabel>
              <Select
                labelId="category-select-label"
                id="category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                label="Category"
              >
                {categories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={3}> {/* Adjusted grid size */}
            <FormControl fullWidth variant="outlined" size="small"> {/* Made FormControl smaller */}
              <InputLabel id="sort-by-select-label">Sort By</InputLabel>
              <Select
                labelId="sort-by-select-label"
                id="sort-by-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                label="Sort By"
              >
                {Object.entries(sortOptions).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          {/* Potential area for more filter buttons/options */}
        </Grid>

        {/* Product Listing Area */} 
        <Box sx={{ mt: 4 }}>
          <Typography variant="body1" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
            {/* Informative placeholder text - Now type-safe */}
            Product listings will appear here. (Implement fetching and display logic)
            Current Filters: Category - {selectedCategory}, Sort By - {sortOptions[sortBy]}, Search - "{searchTerm || 'none'}"
          </Typography>
          {/* TODO: Implement product grid/list component */} 
          {/* <ProductGrid products={filteredAndSortedProducts} /> */} 
        </Box>

      </Box>
    </Container>
  );
};

export default Marketplace; 