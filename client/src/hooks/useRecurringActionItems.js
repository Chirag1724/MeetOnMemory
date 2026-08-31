import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRecurringActionItems,
  getRecurringActionItemById,
  createRecurringActionItem,
  updateRecurringActionItem,
  deleteRecurringActionItem,
} from "../api/recurringActionItemApi";

export const useRecurringActionItems = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["recurringActionItems"],
    queryFn: getRecurringActionItems,
  });

  const createMutation = useMutation({
    mutationFn: createRecurringActionItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurringActionItems"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateRecurringActionItem(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["recurringActionItems"] });
      queryClient.invalidateQueries({
        queryKey: ["recurringActionItem", variables.id],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRecurringActionItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurringActionItems"] });
    },
  });

  const rawItems = query.data;
  const items = Array.isArray(rawItems)
    ? rawItems
    : Array.isArray(rawItems?.data)
      ? rawItems.data
      : [];

  const createItem = async (data) => createMutation.mutateAsync(data);
  const updateItem = async (id, data) =>
    updateMutation.mutateAsync({ id, data });
  const deleteItem = async (id) => deleteMutation.mutateAsync(id);

  const pauseItem = async (id) => {
    const target = items.find((item) => (item._id || item.id) === id);
    const currentlyActive = target?.isActive ?? !target?.isPaused;
    return updateMutation.mutateAsync({
      id,
      data: { isActive: !currentlyActive, isPaused: currentlyActive },
    });
  };

  const completeItem = async (id) => {
    const target = items.find((item) => (item._id || item.id) === id);
    const completedCount = (target?.totalCompleted || 0) + 1;
    return updateMutation.mutateAsync({
      id,
      data: { totalCompleted: completedCount },
    });
  };

  return {
    ...query,
    items,
    data: items,
    loading: query.isLoading,
    isLoading: query.isLoading,
    createMutation,
    updateMutation,
    deleteMutation,
    createItem,
    updateItem,
    deleteItem,
    pauseItem,
    togglePause: pauseItem,
    completeItem,
  };
};

export const useRecurringActionItem = (id) => {
  return useQuery({
    queryKey: ["recurringActionItem", id],
    queryFn: () => getRecurringActionItemById(id),
    enabled: !!id,
  });
};

export const useCreateRecurringActionItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createRecurringActionItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurringActionItems"] });
    },
  });
};

export const useUpdateRecurringActionItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateRecurringActionItem(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["recurringActionItems"] });
      queryClient.invalidateQueries({
        queryKey: ["recurringActionItem", variables.id],
      });
    },
  });
};

export const useDeleteRecurringActionItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteRecurringActionItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurringActionItems"] });
    },
  });
};

export default useRecurringActionItems;
